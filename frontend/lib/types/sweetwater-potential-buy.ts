import type { MatchSource, UnreliableReason } from './product-price';

export interface SweetwaterPotentialBuy {
  id: string;
  listingTitle: string;
  images: string[];
  sweetwaterLink?: string;
  condition?: string;
  price: number;
  originalPrice?: number;
  currency: string;
  sweetwaterListingId: number;
  shipping?: string;
  shippingPrice?: number;
  totalPrice?: number;
  listingCreatedAt?: string;
  sellerUserId?: number;
  sellerName?: string;
  sellerSlug?: string;
  sellerLocation?: string;
  sellerListingCount?: number;
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
  dismissed: boolean;
  purchased: boolean;
}

export interface SweetwaterPotentialBuyStats {
  total: number;
  deals: number;
  noPriceGuide?: number;
  /** Active listings with a trusted sold price that aren't deals. */
  priced?: number;
  lastRunAt?: string;
}

export interface PaginatedSweetwaterPotentialBuys {
  items: SweetwaterPotentialBuy[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}
