import { GUITARS_AND_BASSES_IDS } from './categories';

/**
 * Final value fees. Guitars & Basses carries eBay's reduced music rate; the
 * rest of Musical Instruments & Gear does not.
 * https://www.ebayinc.com/stories/news/ebay-reduces-fees-for-music-enthusiasts/
 */
export const EBAY_FEES = {
  guitarsAndBassesPercent: 6.7,
  standardPercent: 13.6,
  perOrderFee: 0.4,
  perOrderFeeReduced: 0.3,
  /** Orders at or below this total pay the reduced per-order fee. */
  perOrderFeeThreshold: 10,
} as const;

/**
 * Net proceeds on the item price. Does not model what shipping costs the
 * seller, only eBay's cut.
 */
export function ebayNetPayout(price: number, categoryId: string): number {
  const percent = GUITARS_AND_BASSES_IDS.has(categoryId)
    ? EBAY_FEES.guitarsAndBassesPercent
    : EBAY_FEES.standardPercent;
  const perOrder =
    price <= EBAY_FEES.perOrderFeeThreshold ? EBAY_FEES.perOrderFeeReduced : EBAY_FEES.perOrderFee;
  return price - (price * percent) / 100 - perOrder;
}
