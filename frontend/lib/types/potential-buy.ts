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
