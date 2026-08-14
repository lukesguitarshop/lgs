import { describe, expect, test } from 'vitest';
import { EBAY_FEES, ebayNetPayout } from './fees';

describe('ebayNetPayout', () => {
  test('applies the reduced guitars and basses rate', () => {
    expect(ebayNetPayout(1000, '33034')).toBeCloseTo(1000 - 67 - 0.4, 2);
  });

  test('applies the standard rate outside guitars and basses', () => {
    expect(ebayNetPayout(1000, '38072')).toBeCloseTo(1000 - 136 - 0.4, 2);
  });

  test('charges the lower per-order fee on cheap items', () => {
    expect(ebayNetPayout(8, '33034')).toBeCloseTo(8 - 8 * 0.067 - 0.3, 2);
  });

  test('exposes both published rates', () => {
    expect(EBAY_FEES.guitarsAndBassesPercent).toBeCloseTo(6.7, 5);
    expect(EBAY_FEES.standardPercent).toBeCloseTo(13.6, 5);
  });
});
