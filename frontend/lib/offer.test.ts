import { describe, expect, it } from 'vitest';
import { flipProfit, suggestOffer } from './offer';

describe('flipProfit', () => {
  it('takes buy-side tax on price + shipping and sell-side 9.1% + $30 off the median', () => {
    // sell: 2000 * 0.909 - 30 = 1788; buy: (1400 + 100) * 1.07 = 1605
    expect(flipProfit({ price: 1400, shipping: 100, median: 2000 })).toBeCloseTo(183, 5);
  });
});

describe('suggestOffer', () => {
  it('suggests offers that leave $250 and $200 profit, rounded down to $5', () => {
    // net 1788; (1788 - 250) / 1.07 - 100 = 1337.38 -> 1335; (1788 - 200) / 1.07 - 100 = 1384.11 -> 1380
    const s = suggestOffer({ price: 1600, shipping: 100, median: 2000 });
    expect(s).toMatchObject({ kind: 'offer', offer: 1335, maxOffer: 1380 });
    expect(flipProfit({ price: s!.offer, shipping: 100, median: 2000 })).toBeGreaterThanOrEqual(250);
    expect(flipProfit({ price: s!.maxOffer, shipping: 100, median: 2000 })).toBeGreaterThanOrEqual(200);
  });

  it('says to buy at asking when the asking price already clears $250', () => {
    const s = suggestOffer({ price: 1200, shipping: 0, median: 2000 });
    expect(s?.kind).toBe('asking');
    expect(s?.profitAtAsking).toBeCloseTo(1788 - 1284, 5);
  });

  it('reports no room when even a free guitar would not clear $200', () => {
    expect(suggestOffer({ price: 300, shipping: 50, median: 200 })?.kind).toBe('none');
  });

  it('treats unknown shipping as free', () => {
    expect(suggestOffer({ price: 1600, median: 2000 })?.offer).toBe(1435);
  });
});
