import type { ProductSale } from './types/product-price';

export interface MonthPoint {
  /** "2026-10" */
  month: string;
  /** "Oct 26" */
  label: string;
  average: number | null;
  count: number;
}

/**
 * Average sold price per calendar month (UTC) over the last `months` months, oldest first.
 * Months without sales are kept with a null average so the chart's time axis stays even.
 */
export function monthlyAverages(sales: ProductSale[], months: number, now: Date = new Date()): MonthPoint[] {
  const points: MonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
    points.push({ month, label, average: null, count: 0 });
  }

  const byMonth = new Map(points.map(p => [p.month, { point: p, total: 0 }]));
  for (const sale of sales) {
    const key = sale.soldAt.slice(0, 7);
    const bucket = byMonth.get(key);
    if (!bucket || !(sale.amount > 0)) continue;
    bucket.total += sale.amount;
    bucket.point.count++;
  }
  for (const { point, total } of byMonth.values()) {
    point.average = point.count > 0 ? Math.round(total / point.count) : null;
  }

  return points;
}

/** Sales from the last `months` months, newest first. */
export function salesWithin(sales: ProductSale[], months: number, now: Date = new Date()): ProductSale[] {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  return sales
    .filter(s => new Date(s.soldAt) >= cutoff)
    .sort((a, b) => b.soldAt.localeCompare(a.soldAt));
}

const REASON_LABELS: Record<string, string> = {
  text_match: 'Text match',
  few_sales: 'Few sales',
  broad_product: 'Broad product',
  stale: 'Out of date',
};

/** Badge text for why a price isn't trusted. */
export const unreliableLabel = (reason?: string) => (reason ? REASON_LABELS[reason] ?? reason : null);
