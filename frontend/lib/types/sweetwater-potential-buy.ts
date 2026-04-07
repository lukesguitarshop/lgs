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
  priceGuideLow?: number;
  priceGuideHigh?: number;
  discountPercent?: number;
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
  lastRunAt?: string;
}

export interface PaginatedSweetwaterPotentialBuys {
  items: SweetwaterPotentialBuy[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}
