// Suggested offer prices for flipping a guitar: what to offer so reselling at the sold median
// leaves a $200-250 profit after tax, fees and shipping on both ends.

/** Sales tax paid when buying, on the price plus shipping. */
export const BUY_TAX_RATE = 0.07;
/** Reverb selling fees, taken off the sale price when reselling. */
export const SELL_FEE_RATE = 0.091;
/** Shipping paid to send the guitar out when reselling. */
export const SELL_SHIPPING = 30;
/** Profit the opening offer aims for. */
export const TARGET_PROFIT = 250;
/** Least profit worth buying for - the most to offer. */
export const MIN_PROFIT = 200;

export interface FlipInput {
  /** Price paid for the guitar, before shipping and tax. */
  price: number;
  /** Shipping paid when buying; unknown counts as free. */
  shipping?: number | null;
  /** Expected resale price: the sold median. */
  median: number;
}

const saleNet = (median: number) => median * (1 - SELL_FEE_RATE) - SELL_SHIPPING;
const buyCost = (price: number, shipping: number) => (price + shipping) * (1 + BUY_TAX_RATE);

/** Profit from buying at `price` and reselling at the median. */
export function flipProfit({ price, shipping, median }: FlipInput): number {
  return saleNet(median) - buyCost(price, shipping ?? 0);
}

/** Highest price that still leaves `profit`, rounded down to $5. */
function offerFor(median: number, shipping: number, profit: number) {
  return Math.floor(((saleNet(median) - profit) / (1 + BUY_TAX_RATE) - shipping) / 5) * 5;
}

export interface OfferSuggestion {
  /** offer: make an offer; asking: the asking price already clears the target; none: no profitable price. */
  kind: 'offer' | 'asking' | 'none';
  /** Opening offer, leaving at least TARGET_PROFIT. */
  offer: number;
  /** Most to offer, leaving at least MIN_PROFIT. */
  maxOffer: number;
  /** Profit if bought at the asking price (negative is a loss). */
  profitAtAsking: number;
}

export function suggestOffer(input: FlipInput): OfferSuggestion | null {
  if (!(input.median > 0)) return null;
  const shipping = input.shipping ?? 0;
  const offer = offerFor(input.median, shipping, TARGET_PROFIT);
  const maxOffer = offerFor(input.median, shipping, MIN_PROFIT);
  const profitAtAsking = flipProfit(input);

  const kind = maxOffer <= 0 ? 'none' : profitAtAsking >= TARGET_PROFIT ? 'asking' : 'offer';
  return { kind, offer, maxOffer, profitAtAsking };
}
