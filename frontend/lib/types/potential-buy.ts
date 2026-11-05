import type { MatchSource, UnreliableReason } from './product-price';

export interface PotentialBuy {
  id: string;
  listingTitle: string;
  description?: string;
  images: string[];
  reverbLink?: string;
  condition?: string;
  price: number;
  currency: string;
  shippingPrice?: number;
  shippingEstimated?: boolean;
  shipToPostalCode?: string;
  totalPrice?: number;
  sellerName?: string;
  sellerSlug?: string;
  sellerFeedbackCount?: number;
  sellerRating?: number;
  sellerLocation?: string;
  sellerPreferred?: boolean;
  reverbListingId: number;
  priceGuideId?: string;
  priceGuideLow?: number;
  priceGuideHigh?: number;
  discountPercent?: number;
  make?: string;
  model?: string;
  productId?: string;
  productTitle?: string;
  productUrl?: string;
  /** Median sold price (Good to Mint, US) over soldWindowMonths. */
  soldMedian?: number;
  soldSaleCount?: number;
  soldWindowMonths?: number;
  matchSource?: MatchSource;
  /** True when the median is trusted enough to call a deal; hasPriceGuide mirrors it. */
  priceReliable?: boolean;
  unreliableReason?: UnreliableReason;
  /** The sentence mentioning a headstock or neck repair, when the listing has one. */
  repairNote?: string;
  /** When the guitar was made as the matcher read it ("2015", "2010s"). */
  detectedYear?: string;
  /** Where detectedYear came from: listing, title, serial or description. */
  yearSource?: string;
  isDeal: boolean;
  hasPriceGuide: boolean;
  firstSeenAt: string;
  lastCheckedAt: string;
  listingCreatedAt?: string;
  dismissed: boolean;
  purchased: boolean;
  soldAt?: string;
  missedDeal?: boolean;
  wasInDeals?: boolean;
}

export interface PotentialBuyStats {
  total: number;
  deals: number;
  noPriceGuide?: number;
  /** Active listings with a trusted sold price that aren't deals. */
  priced?: number;
  lastRunAt?: string;
  missedLast7Days?: number;
  missedLast30Days?: number;
  missedInDealsLast30Days?: number;
}

export interface PaginatedPotentialBuys {
  items: PotentialBuy[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}
