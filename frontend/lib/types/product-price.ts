/** How a deal-finder listing was tied to its Reverb product. */
export type MatchSource = 'manual' | 'alias' | 'listing_link' | 'text_search';

/** Why a sold median isn't trusted enough to call a deal. */
export type UnreliableReason = 'text_match' | 'few_sales' | 'broad_product' | 'stale';

export interface ProductSale {
  soldAt: string;
  condition?: string;
  amount: number;
  listingId?: string;
}

/** A Reverb product with its last 24 months of US sales in Good to Mint condition. */
export interface ProductPrice {
  productId: string;
  title: string;
  brand?: string;
  slug?: string;
  webUrl?: string;
  usedLowPrice?: number;
  newLowPrice?: number;
  sales: ProductSale[];
  median?: number;
  windowMonths: number;
  saleCount: number;
  low?: number;
  high?: number;
  isBroad: boolean;
  fetchedAt: string;
}

export interface ProductPriceResponse {
  product: ProductPrice;
  stale: boolean;
}

/** A Reverb listing as the sold-history panel shows it - sold listings included. */
export interface ReverbListingPreview {
  id: number;
  title: string;
  state: string;
  condition?: string;
  listedPrice?: number;
  currency: string;
  year?: string;
  finish?: string;
  sellerName?: string;
  publishedAt?: string;
  /** Seller-written HTML - convert to text before showing. */
  description?: string;
  /** The sentence mentioning a headstock or neck repair, when the listing has one. */
  repairNote?: string;
  photos: { thumb: string; full?: string }[];
}
