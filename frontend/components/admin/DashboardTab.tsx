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

// Trade graph node — supports both branching (1→many) and convergence (many→1)
interface TradeGraphNode {
  name: string;
  parents: string[];   // guitars that traded INTO this one
  children: string[];  // guitars this was traded FOR
  soldFor: number | null;
  status: 'sold' | 'traded' | 'for_sale' | 'unsold';
}

interface TradeGroup {
  nodes: Map<string, TradeGraphNode>;
  roots: string[];     // entry points (no parents)
  leaves: string[];    // exit points (no children)
}

function buildTradeGroups(transactions: Transaction[]): TradeGroup[] {
  const traded = transactions.filter(t => t.transactionType === 'traded');
  const sold = transactions.filter(t => t.transactionType === 'sold');
  const forSale = transactions.filter(t => t.transactionType === 'for_sale');

  const soldMap = new Map<string, number>();
  for (const s of sold) {
    if (s.revenue !== null) soldMap.set(s.guitarName, s.revenue);
  }
  const forSaleSet = new Set(forSale.map(f => f.guitarName));

  // Build the full graph
  const allNodes = new Map<string, TradeGraphNode>();

  function getOrCreate(name: string): TradeGraphNode {
    if (!allNodes.has(name)) {
      let status: TradeGraphNode['status'] = 'unsold';
      let soldFor: number | null = null;
      if (soldMap.has(name)) { status = 'sold'; soldFor = soldMap.get(name)!; }
      else if (forSaleSet.has(name)) { status = 'for_sale'; }
      allNodes.set(name, { name, parents: [], children: [], soldFor, status });
    }
    return allNodes.get(name)!;
  }

  for (const t of traded) {
    const node = getOrCreate(t.guitarName);
    node.status = node.status === 'sold' || node.status === 'for_sale' ? node.status : 'traded';
    if (t.tradeFor && t.tradeFor.length > 0) {
      for (const childName of t.tradeFor) {
        if (!node.children.includes(childName)) node.children.push(childName);
        const child = getOrCreate(childName);
        if (!child.parents.includes(t.guitarName)) child.parents.push(t.guitarName);
      }
    }
  }

  // Find connected components using BFS
  const visited = new Set<string>();
  const groups: TradeGroup[] = [];

  for (const name of allNodes.keys()) {
    if (visited.has(name)) continue;
    const component = new Map<string, TradeGraphNode>();
    const queue = [name];
    visited.add(name);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const node = allNodes.get(current)!;
      component.set(current, node);
      for (const neighbor of [...node.parents, ...node.children]) {
        if (!visited.has(neighbor) && allNodes.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    const roots = Array.from(component.values()).filter(n => n.parents.length === 0).map(n => n.name);
    const leaves = Array.from(component.values()).filter(n => n.children.length === 0).map(n => n.name);
    groups.push({ nodes: component, roots, leaves });
  }

  return groups;
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

  const tradeGroups = buildTradeGroups(transactions);

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
      {tradeGroups.length > 0 && (
        <div className="bg-[#FFFFF3] border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-[#020E1C] mb-4">Trade Chains</h3>
          <div className="space-y-3">
            {tradeGroups.map((group, i) => (
              <div key={i} className="py-2 px-3 bg-white rounded border border-gray-100">
                <TradeGroupView group={group} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ node }: { node: TradeGraphNode }) {
  switch (node.status) {
    case 'sold':
      return <span className="text-sm font-semibold text-green-700">Sold for {formatCurrency(node.soldFor!)}</span>;
    case 'for_sale':
      return <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">For Sale</span>;
    case 'traded':
      return null;
    default:
      return <span className="text-xs text-gray-400">(not yet sold)</span>;
  }
}

function TradeGroupView({ group }: { group: TradeGroup }) {
  const rendered = new Set<string>();

  // Render a node and follow its children recursively
  function renderFlow(name: string): React.ReactNode {
    if (rendered.has(name)) return null;
    rendered.add(name);
    const node = group.nodes.get(name);
    if (!node) return null;

    // Check if this node has convergence (multiple parents)
    const hasConvergence = node.parents.length > 1;

    // Leaf node
    if (node.children.length === 0) {
      return (
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#020E1C]">{node.name}</span>
          <StatusBadge node={node} />
        </span>
      );
    }

    // Single child — inline
    if (node.children.length === 1) {
      return (
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[#020E1C]">{node.name}</span>
          <ArrowRight className="h-4 w-4 text-[#6E0114] shrink-0" />
          {renderFlow(node.children[0])}
        </span>
      );
    }

    // Multiple children — branch
    return (
      <div>
        <span className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-[#020E1C]">{node.name}</span>
          <ArrowRight className="h-4 w-4 text-[#6E0114]" />
          <span className="text-xs text-gray-500">({node.children.length} guitars)</span>
        </span>
        <div className="ml-6 border-l-2 border-[#6E0114]/30 pl-3 space-y-1">
          {node.children.map((childName, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[#6E0114] mt-0.5">&#8627;</span>
              <div>{renderFlow(childName)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Check for convergence: multiple roots leading to the same node
  // Find nodes with multiple parents
  const convergencePoints = Array.from(group.nodes.values()).filter(n => n.parents.length > 1);

  if (convergencePoints.length > 0) {
    // Render convergence: show all roots merging, then continue from merge point
    return (
      <div className="space-y-1">
        {convergencePoints.map((mergeNode, ci) => {
          // Render each parent chain leading to the merge point
          const parentChains = mergeNode.parents.map(parentName => {
            // Walk back up from parent to find the root of each chain
            const chain: string[] = [];
            let current = parentName;
            const localVisited = new Set<string>();
            while (current && !localVisited.has(current)) {
              localVisited.add(current);
              chain.unshift(current);
              const node = group.nodes.get(current);
              if (node && node.parents.length === 1) {
                current = node.parents[0];
              } else {
                break;
              }
            }
            return chain;
          });

          // Mark parent chains as rendered
          for (const chain of parentChains) {
            for (const name of chain) rendered.add(name);
          }

          return (
            <div key={ci}>
              {/* Converging parents */}
              <div className="border-l-2 border-blue-300 pl-3 space-y-1 mb-1">
                {parentChains.map((chain, pi) => (
                  <div key={pi} className="flex flex-wrap items-center gap-2">
                    {chain.map((name, j) => {
                      const n = group.nodes.get(name);
                      return (
                        <span key={j} className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#020E1C]">{name}</span>
                          {j < chain.length - 1 && <ArrowRight className="h-4 w-4 text-[#6E0114] shrink-0" />}
                        </span>
                      );
                    })}
                    <span className="text-blue-500">&#8600;</span>
                  </div>
                ))}
              </div>
              {/* Merge point and continuation */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-blue-500 mr-1">&#8594;</span>
                {renderFlow(mergeNode.name)}
              </div>
            </div>
          );
        })}
        {/* Render any remaining roots not part of a convergence */}
        {group.roots.filter(r => !rendered.has(r)).map((root, i) => (
          <div key={'r' + i}>{renderFlow(root)}</div>
        ))}
      </div>
    );
  }

  // No convergence — render from roots
  return (
    <div className="space-y-1">
      {group.roots.map((root, i) => (
        <div key={i}>{renderFlow(root)}</div>
      ))}
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
