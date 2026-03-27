export interface PlatformStat {
  platform: string;
  count: number;
  totalProfit: number;
  totalRevenue: number;
}

export interface MonthlyBreakdown {
  year: number;
  month: number;
  profit: number;
  revenue: number;
  count: number;
}

export interface MonthlySnapshot {
  year: number;
  month: number;
  cumulativeProfit: number;
}

export interface FinanceSummary {
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  grossProfit: number;
  platformStats: PlatformStat[];
  monthlyBreakdown: MonthlyBreakdown[];
  monthlySnapshots: MonthlySnapshot[];
}
