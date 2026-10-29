'use client';
import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import { FinanceSummary, MonthlySnapshot } from '@/lib/types/finance-summary';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/responsive-table';

interface PivotRow {
  key: string;
  label: string;
  labelClassName?: string;
  value: (year: number) => number | null | undefined;
  empty: React.ReactNode;
  className: string;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function MonthlyBreakdownTab() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'monthly' | 'cumulative'>('monthly');

  useEffect(() => {
    api
      .authGet<FinanceSummary>('/admin/finance-summary')
      .then(setSummary)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Build merged data from snapshots (historical) + calculated (current/future)
  // Snapshots store cumulative profit. We derive monthly from consecutive cumulative values.
  const { years, monthlyValues, cumulativeValues } = useMemo(() => {
    if (!summary) return { years: [] as number[], monthlyValues: new Map<string, number>(), cumulativeValues: new Map<string, number>() };

    const monthly = new Map<string, number>(); // "year-month" -> monthly profit
    const cumulative = new Map<string, number>(); // "year-month" -> cumulative profit
    const yearSet = new Set<number>();

    // Process snapshots (historical data with cumulative values)
    const snapshots = summary.monthlySnapshots || [];
    if (snapshots.length > 0) {
      // Group by year, sorted by month
      const byYear = new Map<number, MonthlySnapshot[]>();
      for (const s of snapshots) {
        yearSet.add(s.year);
        if (!byYear.has(s.year)) byYear.set(s.year, []);
        byYear.get(s.year)!.push(s);
      }

      // Sort each year's snapshots by month
      for (const [, yearSnapshots] of byYear) {
        yearSnapshots.sort((a, b) => a.month - b.month);
      }

      // Get all years sorted
      const sortedYears = Array.from(byYear.keys()).sort((a, b) => a - b);

      // Derive monthly profits from cumulative values
      // Need to track the previous cumulative value (may cross year boundary)
      let prevCumulative = 0;
      for (const year of sortedYears) {
        const yearSnapshots = byYear.get(year)!;
        // Get the last cumulative from the previous year
        const prevYear = sortedYears[sortedYears.indexOf(year) - 1];
        if (prevYear) {
          const prevYearSnapshots = byYear.get(prevYear)!;
          prevCumulative = prevYearSnapshots[prevYearSnapshots.length - 1].cumulativeProfit;
        }

        for (const s of yearSnapshots) {
          const key = `${s.year}-${s.month}`;
          cumulative.set(key, s.cumulativeProfit);
          // Monthly = this cumulative - previous cumulative
          const monthlyProfit = s.cumulativeProfit - prevCumulative;
          monthly.set(key, monthlyProfit);
          prevCumulative = s.cumulativeProfit;
        }
      }
    }

    // Also add any calculated monthlyBreakdown entries that aren't covered by snapshots
    // (for months going forward after historical data ends)
    for (const entry of summary.monthlyBreakdown) {
      const key = `${entry.year}-${entry.month}`;
      yearSet.add(entry.year);
      if (!cumulative.has(key)) {
        monthly.set(key, entry.profit - entry.expenses);
      }
    }

    const yrs = Array.from(yearSet).sort((a, b) => a - b);
    return { years: yrs, monthlyValues: monthly, cumulativeValues: cumulative };
  }, [summary]);

  // Compute cell values based on view mode
  const cellValues = useMemo(() => {
    if (viewMode === 'cumulative') {
      // For cumulative view, use snapshot cumulative values directly where available
      // For non-snapshot months, compute running sum from monthly values
      const values = new Map<string, number>();
      for (const year of years) {
        // Seed runningSum from the last computed value of the previous year
        // so live months continue from the last snapshot rather than restarting at 0
        let runningSum = 0;
        const prevYearIdx = years.indexOf(year) - 1;
        if (prevYearIdx >= 0) {
          const prevYear = years[prevYearIdx];
          for (let m = 12; m >= 1; m--) {
            const prevKey = `${prevYear}-${m}`;
            if (values.has(prevKey)) {
              runningSum = values.get(prevKey)!;
              break;
            }
          }
        }

        for (let month = 1; month <= 12; month++) {
          const key = `${year}-${month}`;
          if (cumulativeValues.has(key)) {
            // Use snapshot value and keep runningSum in sync so the first
            // non-snapshot month continues from here rather than zero
            runningSum = cumulativeValues.get(key)!;
            values.set(key, runningSum);
          } else if (monthlyValues.has(key)) {
            runningSum += monthlyValues.get(key)!;
            values.set(key, runningSum);
          }
        }
      }
      return values;
    } else {
      // Monthly view - just return monthly values
      return monthlyValues;
    }
  }, [years, monthlyValues, cumulativeValues, viewMode]);

  // Check if a year has a full set of data (starts from Jan)
  const isPartialYear = useMemo(() => {
    const partial = new Set<number>();
    for (const year of years) {
      const hasJan = monthlyValues.has(`${year}-1`);
      if (!hasJan && year !== currentYear) {
        partial.add(year);
      }
    }
    return partial;
  }, [years, monthlyValues, currentYear]);

  // Yearly totals (sum of monthly profits) — N/A for partial years
  const yearlyTotals = useMemo(() => {
    const totals = new Map<number, number | null>();
    for (const year of years) {
      if (isPartialYear.has(year)) {
        totals.set(year, null);
        continue;
      }
      let total = 0;
      for (let month = 1; month <= 12; month++) {
        const key = `${year}-${month}`;
        const val = monthlyValues.get(key);
        if (val !== undefined) total += val;
      }
      totals.set(year, total);
    }
    return totals;
  }, [years, monthlyValues, isPartialYear]);

  // Avg per month — N/A for partial years
  const yearlyAvg = useMemo(() => {
    const avgs = new Map<number, number | null>();
    for (const year of years) {
      if (isPartialYear.has(year)) {
        avgs.set(year, null);
        continue;
      }
      let total = 0;
      let count = 0;
      for (let month = 1; month <= 12; month++) {
        const key = `${year}-${month}`;
        const val = monthlyValues.get(key);
        if (val !== undefined) {
          total += val;
          count++;
        }
      }
      avgs.set(year, count > 0 ? total / count : 0);
    }
    return avgs;
  }, [years, monthlyValues, isPartialYear]);

  // This month's profit
  const thisMonthProfit = useMemo(() => {
    const vals = new Map<number, number | null>();
    for (const year of years) {
      const key = `${year}-${currentMonth}`;
      const val = monthlyValues.get(key);
      vals.set(year, val !== undefined ? val : null);
    }
    return vals;
  }, [years, monthlyValues, currentMonth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#6E0114]" />
      </div>
    );
  }

  if (!summary || years.length === 0) {
    return <p className="text-center py-8 text-gray-500">No monthly data available.</p>;
  }

  const colorClass = (value: number) =>
    value > 0 ? 'text-green-700' : value < 0 ? 'text-red-600' : 'text-gray-500';

  // One row per month, then the summary rows; each knows how to read a year.
  const monthRows: PivotRow[] = MONTH_NAMES.map((name, idx) => {
    const month = idx + 1;
    return {
      key: String(month),
      label: name,
      value: (year) => cellValues.get(`${year}-${month}`),
      empty: <>&mdash;</>,
      className: `border-b ${month === currentMonth ? 'bg-yellow-50 font-semibold' : 'hover:bg-gray-50'}`,
    };
  });
  const summaryRows: PivotRow[] = [
    {
      key: 'total',
      label: 'Yearly Total',
      value: (year) => yearlyTotals.get(year),
      empty: 'N/A',
      className: 'border-t-2 border-[#6E0114] bg-gray-100 font-semibold',
    },
    {
      key: 'this-month',
      label: `This Month (${MONTH_NAMES[currentMonth - 1]})`,
      value: (year) => thisMonthProfit.get(year),
      empty: <>&mdash;</>,
      className: 'bg-yellow-50 font-semibold',
    },
    {
      key: 'avg',
      label: 'Avg/Month',
      labelClassName: 'font-semibold',
      value: (year) => yearlyAvg.get(year),
      empty: 'N/A',
      className: 'bg-gray-100',
    },
  ];

  const columns: ResponsiveColumn<PivotRow>[] = [
    {
      id: 'month',
      header: 'Month',
      priority: 'primary',
      headerClassName: 'text-left',
      cellClassName: (row) => `text-left ${row.labelClassName ?? ''}`,
      cell: (row) => row.label,
    },
    ...years.map((year): ResponsiveColumn<PivotRow> => ({
      id: String(year),
      header: String(year),
      priority: 'key',
      headerClassName: 'text-right',
      cellClassName: (row) => {
        const v = row.value(year);
        return `text-right ${v === null || v === undefined ? 'text-gray-400' : colorClass(v)}`;
      },
      isEmpty: (row) => {
        const v = row.value(year);
        return v === null || v === undefined;
      },
      emptyLabel: 'No data',
      cell: (row) => {
        const v = row.value(year);
        return v === null || v === undefined ? row.empty : formatCurrency(v);
      },
      mobileCell: (row) => <span className={colorClass(row.value(year)!)}>{formatCurrency(row.value(year)!)}</span>,
    })),
  ];

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant={viewMode === 'monthly' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('monthly')}
        >
          Monthly Profit
        </Button>
        <Button
          variant={viewMode === 'cumulative' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('cumulative')}
        >
          Cumulative
        </Button>
      </div>

      {/* Table */}
      <ResponsiveTable
        label="Monthly breakdown"
        columns={columns}
        rows={monthRows}
        rowKey={(row) => row.key}
        rowClassName={(row) => row.className}
        footerRows={summaryRows}
        footerRowClassName={(row) => row.className}
        tableClassName="w-full text-sm bg-[#FFFFF3]"
        containerClassName="rounded-lg border"
        headerRowClassName="border-b bg-[#020E1C] text-white"
        thClassName="px-4 py-2 font-semibold"
        tdClassName="px-4 py-2"
        mobilePageSize={12}
      />
    </div>
  );
}
