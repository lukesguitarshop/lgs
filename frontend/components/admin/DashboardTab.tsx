'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { FinanceSummary } from '@/lib/types/finance-summary';
import { Transaction } from '@/lib/types/transaction';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface TradeChain {
  guitars: string[];
  finalSalePrice: number | null;
}

function buildTradeChains(transactions: Transaction[]): TradeChain[] {
  const traded = transactions.filter(t => t.transactionType === 'traded');
  const sold = transactions.filter(t => t.transactionType === 'sold');

  // Build a map: guitarName -> what it was traded for
  const tradeMap = new Map<string, string>();
  for (const t of traded) {
    if (t.tradeFor) {
      tradeMap.set(t.guitarName, t.tradeFor);
    }
  }

  // Find chain starts: guitars that were traded but are NOT the tradeFor target of another trade
  const tradeTargets = new Set(traded.map(t => t.tradeFor).filter(Boolean));
  const chainStarts = traded
    .filter(t => !tradeTargets.has(t.guitarName))
    .map(t => t.guitarName);

  const chains: TradeChain[] = [];
  const visited = new Set<string>();

  for (const start of chainStarts) {
    if (visited.has(start)) continue;
    const chain: string[] = [start];
    visited.add(start);
    let current = start;

    while (tradeMap.has(current)) {
      const next = tradeMap.get(current)!;
      chain.push(next);
      visited.add(next);
      current = next;
    }

    // Check if the last item in chain was sold
    const lastGuitarSale = sold.find(s => s.guitarName === current);
    chains.push({
      guitars: chain,
      finalSalePrice: lastGuitarSale?.revenue ?? null,
    });
  }

  // Also include single traded items not in any chain
  for (const t of traded) {
    if (!visited.has(t.guitarName)) {
      chains.push({
        guitars: [t.guitarName],
        finalSalePrice: null,
      });
    }
  }

  return chains;
}

export default function DashboardTab() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [summaryData, txData] = await Promise.all([
          api.authGet<FinanceSummary>('/admin/finance-summary'),
          api.authGet<Transaction[]>('/admin/transactions'),
        ]);
        setSummary(summaryData);
        setTransactions(txData);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#6E0114]" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-20 text-gray-500">
        Failed to load dashboard data.
      </div>
    );
  }

  // Quick stats calculations
  const totalCount = transactions.length;
  const profitable = transactions.filter(t => (t.profit ?? 0) > 0).length;
  const unprofitable = totalCount - profitable;
  const avgProfit = totalCount > 0
    ? transactions.reduce((sum, t) => sum + (t.profit ?? 0), 0) / totalCount
    : 0;
  const bestTx = transactions.length > 0
    ? transactions.reduce((best, t) => (t.profit ?? 0) > (best.profit ?? 0) ? t : best)
    : null;
  const worstTx = transactions.length > 0
    ? transactions.reduce((worst, t) => (t.profit ?? 0) < (worst.profit ?? 0) ? t : worst)
    : null;

  const tradeChains = buildTradeChains(transactions);

  // Prepare platform chart data
  const chartData = summary.platformStats.map(p => ({
    platform: p.platform,
    profit: p.totalProfit,
  }));

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Revenue"
          value={formatCurrency(summary.totalRevenue)}
        />
        <SummaryCard
          label="Extra Expenses"
          value={formatCurrency(summary.totalExpenses)}
        />
        <SummaryCard
          label="Gross Profit"
          value={formatCurrency(summary.grossProfit)}
        />
        <SummaryCard
          label="Net Profit"
          value={formatCurrency(summary.totalProfit)}
          valueColor={summary.totalProfit >= 0 ? 'text-green-700' : 'text-red-600'}
          icon={summary.totalProfit >= 0
            ? <TrendingUp className="h-5 w-5 text-green-600" />
            : <TrendingDown className="h-5 w-5 text-red-500" />
          }
        />
      </div>

      {/* Platform Breakdown Chart */}
      {chartData.length > 0 && (
        <div className="bg-[#FFFFF3] border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-[#020E1C] mb-4">Profit by Platform</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="platform" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v: number) => `$${v}`} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number | undefined) => [formatCurrency(value ?? 0), 'Profit']}
                contentStyle={{ backgroundColor: '#FFFFF3', border: '1px solid #e5e7eb' }}
              />
              <Bar dataKey="profit" fill="#6E0114" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Quick Stats */}
      <div className="bg-[#FFFFF3] border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-[#020E1C] mb-4">Quick Stats</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatItem label="Total Transactions" value={totalCount.toString()} />
          <StatItem
            label="Profitable"
            value={profitable.toString()}
            valueColor="text-green-700"
          />
          <StatItem
            label="Unprofitable"
            value={unprofitable.toString()}
            valueColor="text-red-600"
          />
          <StatItem
            label="Avg Profit / Transaction"
            value={formatCurrency(avgProfit)}
            valueColor={avgProfit >= 0 ? 'text-green-700' : 'text-red-600'}
          />
          {bestTx && (
            <StatItem
              label="Best Transaction"
              value={`${bestTx.guitarName} (${formatCurrency(bestTx.profit ?? 0)})`}
              valueColor="text-green-700"
            />
          )}
          {worstTx && (
            <StatItem
              label="Worst Transaction"
              value={`${worstTx.guitarName} (${formatCurrency(worstTx.profit ?? 0)})`}
              valueColor="text-red-600"
            />
          )}
        </div>
      </div>

      {/* Trade Chains */}
      {tradeChains.length > 0 && (
        <div className="bg-[#FFFFF3] border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-[#020E1C] mb-4">Trade Chains</h3>
          <div className="space-y-3">
            {tradeChains.map((chain, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-2 py-2 px-3 bg-white rounded border border-gray-100"
              >
                {chain.guitars.map((guitar, j) => (
                  <span key={j} className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#020E1C]">{guitar}</span>
                    {j < chain.guitars.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-[#6E0114]" />
                    )}
                  </span>
                ))}
                {chain.finalSalePrice !== null && (
                  <>
                    <ArrowRight className="h-4 w-4 text-[#6E0114]" />
                    <span className="text-sm font-semibold text-green-700">
                      Sold for {formatCurrency(chain.finalSalePrice)}
                    </span>
                  </>
                )}
                {chain.finalSalePrice === null && (
                  <span className="text-xs text-gray-400 ml-2">(not yet sold)</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  valueColor,
  icon,
}: {
  label: string;
  value: string;
  valueColor?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-[#FFFFF3] border border-gray-200 rounded-lg p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <p className={`text-2xl font-bold ${valueColor ?? 'text-[#020E1C]'}`}>{value}</p>
        {icon}
      </div>
    </div>
  );
}

function StatItem({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-base font-semibold ${valueColor ?? 'text-[#020E1C]'}`}>{value}</p>
    </div>
  );
}
