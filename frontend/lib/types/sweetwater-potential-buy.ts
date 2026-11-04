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
  lastRunAt?: string;
}

export interface PaginatedSweetwaterPotentialBuys {
  items: SweetwaterPotentialBuy[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}
