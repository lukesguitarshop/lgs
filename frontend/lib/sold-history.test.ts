import { describe, expect, it } from 'vitest';
import { monthlyAverages, salesWithin, unreliableLabel } from './sold-history';

const now = new Date('2026-11-05T12:00:00Z');

describe('monthlyAverages', () => {
  it('averages each month and keeps empty months as null, oldest first', () => {
    const points = monthlyAverages(
      [
        { soldAt: '2026-11-02T10:00:00Z', amount: 1000 },
        { soldAt: '2026-11-03T10:00:00Z', amount: 2001 },
        { soldAt: '2026-09-15T10:00:00Z', amount: 1800 },
        { soldAt: '2026-04-30T10:00:00Z', amount: 9999 }, // outside 6 months
      ],
      6,
      now,
    );

    expect(points.map(p => p.month)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
    expect(points.map(p => p.average)).toEqual([null, null, null, 1800, null, 1501]);
    expect(points[5].count).toBe(2);
    expect(points[3].label).toBe('Sep 26');
  });

  it('crosses year boundaries', () => {
    const points = monthlyAverages([{ soldAt: '2025-12-20T00:00:00Z', amount: 500 }], 12, now);
    expect(points[0].month).toBe('2025-12');
    expect(points[0].average).toBe(500);
  });
});

describe('salesWithin', () => {
  it('keeps recent sales, newest first', () => {
    const sales = salesWithin(
      [
        { soldAt: '2026-08-01T00:00:00Z', amount: 1 },
        { soldAt: '2026-10-01T00:00:00Z', amount: 2 },
        { soldAt: '2025-10-01T00:00:00Z', amount: 3 },
      ],
      6,
      now,
    );
    expect(sales.map(s => s.amount)).toEqual([2, 1]);
  });
});

describe('unreliableLabel', () => {
  it('maps reasons to badge text', () => {
    expect(unreliableLabel('few_sales')).toBe('Few sales');
    expect(unreliableLabel(undefined)).toBeNull();
  });
});
