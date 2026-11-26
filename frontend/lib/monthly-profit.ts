import type { FinanceSummary, MonthlySnapshot } from '@/lib/types/finance-summary';

export interface MonthlyProfit {
  /** Every year that has data, ascending. */
  years: number[];
  /** "year-month" -> net profit for that month. */
  monthlyValues: Map<string, number>;
  /** "year-month" -> cumulative profit, for months covered by a snapshot. */
  cumulativeValues: Map<string, number>;
}

export const monthKey = (year: number, month: number) => `${year}-${month}`;

/**
 * Net profit per month. Snapshots (historical) store cumulative profit, so a month's profit
 * is the difference between consecutive snapshots; months without a snapshot use the
 * calculated breakdown (profit less extra expenses).
 */
export function buildMonthlyProfit(summary: FinanceSummary): MonthlyProfit {
  const monthlyValues = new Map<string, number>();
  const cumulativeValues = new Map<string, number>();
  const yearSet = new Set<number>();

  const snapshots: MonthlySnapshot[] = [...(summary.monthlySnapshots || [])].sort(
    (a, b) => a.year - b.year || a.month - b.month,
  );
  let prevCumulative = 0;
  for (const s of snapshots) {
    const key = monthKey(s.year, s.month);
    yearSet.add(s.year);
    cumulativeValues.set(key, s.cumulativeProfit);
    monthlyValues.set(key, s.cumulativeProfit - prevCumulative);
    prevCumulative = s.cumulativeProfit;
  }

  for (const entry of summary.monthlyBreakdown || []) {
    const key = monthKey(entry.year, entry.month);
    yearSet.add(entry.year);
    if (!cumulativeValues.has(key)) {
      monthlyValues.set(key, entry.profit - entry.expenses);
    }
  }

  return {
    years: Array.from(yearSet).sort((a, b) => a - b),
    monthlyValues,
    cumulativeValues,
  };
}

/** Net profit for one month; 0 when nothing has been recorded for it yet. */
export function profitForMonth(summary: FinanceSummary, year: number, month: number): number {
  return buildMonthlyProfit(summary).monthlyValues.get(monthKey(year, month)) ?? 0;
}
