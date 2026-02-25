export interface PotentialBuy {
  id: string;
  listingTitle: string;
  description?: string;
  images: string[];
  reverbLink?: string;
  condition?: string;
  price: number;
  currency: string;
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
}

export interface PotentialBuyStats {
  total: number;
  deals: number;
  lastRunAt?: string;
}

export interface PaginatedPotentialBuys {
  items: PotentialBuy[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}
