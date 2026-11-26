import { describe, it, expect } from 'vitest';
import { buildMonthlyProfit, profitForMonth } from './monthly-profit';
import type { FinanceSummary } from './types/finance-summary';

const summary = (overrides: Partial<FinanceSummary>): FinanceSummary => ({
  totalRevenue: 0,
  totalExpenses: 0,
  totalProfit: 0,
  grossProfit: 0,
  platformStats: [],
  monthlyBreakdown: [],
  monthlySnapshots: [],
  ...overrides,
});

describe('buildMonthlyProfit', () => {
  it('derives monthly profit from cumulative snapshots, across a year boundary', () => {
    const { years, monthlyValues } = buildMonthlyProfit(
      summary({
        monthlySnapshots: [
          { year: 2026, month: 1, cumulativeProfit: 1500 },
          { year: 2025, month: 12, cumulativeProfit: 1000 },
          { year: 2025, month: 11, cumulativeProfit: 400 },
        ],
      }),
    );
    expect(years).toEqual([2025, 2026]);
    expect(monthlyValues.get('2025-11')).toBe(400);
    expect(monthlyValues.get('2025-12')).toBe(600);
    expect(monthlyValues.get('2026-1')).toBe(500);
  });

  it('uses the calculated breakdown, less expenses, for months without a snapshot', () => {
    const { monthlyValues } = buildMonthlyProfit(
      summary({
        monthlySnapshots: [{ year: 2026, month: 10, cumulativeProfit: 900 }],
        monthlyBreakdown: [
          { year: 2026, month: 10, profit: 1, revenue: 0, count: 1, expenses: 0 },
          { year: 2026, month: 11, profit: 800, revenue: 3000, count: 2, expenses: 150 },
        ],
      }),
    );
    expect(monthlyValues.get('2026-10')).toBe(900);
    expect(monthlyValues.get('2026-11')).toBe(650);
  });
});

describe('profitForMonth', () => {
  it('is 0 for a month with no data', () => {
    expect(profitForMonth(summary({}), 2026, 11)).toBe(0);
  });
});
