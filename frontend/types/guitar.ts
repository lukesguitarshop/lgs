/**
 * Guitar Price Database - TypeScript Type Definitions
 * These interfaces match the C# models from the backend API
 */

// ==================== Enums ====================

/**
 * Guitar condition levels (matches C# GuitarCondition enum)
 */
export enum GuitarCondition {
  BrandNew = 0,
  Mint = 1,
  Excellent = 2,
  VeryGood = 3,
  Good = 4,
  Fair = 5,
  Poor = 6,
}

/**
 * Human-readable condition names
 */
export const ConditionNames: Record<GuitarCondition, string> = {
  [GuitarCondition.BrandNew]: 'Brand New',
  [GuitarCondition.Mint]: 'Mint',
  [GuitarCondition.Excellent]: 'Excellent',
  [GuitarCondition.VeryGood]: 'Very Good',
  [GuitarCondition.Good]: 'Good',
  [GuitarCondition.Fair]: 'Fair',
  [GuitarCondition.Poor]: 'Poor',
};

/**
 * Condition colors for charts and badges
 */
export const ConditionColors: Record<GuitarCondition, string> = {
  [GuitarCondition.BrandNew]: '#2563eb',
  [GuitarCondition.Mint]: '#7c3aed',
  [GuitarCondition.Excellent]: '#059669',
  [GuitarCondition.VeryGood]: '#d97706',
  [GuitarCondition.Good]: '#dc2626',
  [GuitarCondition.Fair]: '#9333ea',
  [GuitarCondition.Poor]: '#6b7280',
};

// ==================== Specification Interfaces ====================

/**
 * Guitar body specifications
 */
export interface BodySpecs {
  wood?: string | null;
  top?: string | null;
  binding?: string | null;
}

/**
 * Guitar neck specifications
 */
export interface NeckSpecs {
  wood?: string | null;
  profile?: string | null;
  frets?: number | null;
  scaleLength?: number | null;
}

/**
 * Guitar electronics specifications
 */
export interface ElectronicsSpecs {
  pickups?: string[] | null;
  controls?: string[] | null;
}

/**
 * Guitar hardware specifications
 */
export interface HardwareSpecs {
  bridge?: string | null;
  tailpiece?: string | null;
  tuners?: string | null;
}

/**
 * Complete guitar specifications (matches C# GuitarSpecs)
 */
export interface GuitarSpecs {
  body?: BodySpecs | null;
  neck?: NeckSpecs | null;
  electronics?: ElectronicsSpecs | null;
  hardware?: HardwareSpecs | null;
}

// ==================== Price Interfaces ====================

/**
 * Price data for a specific condition (matches C# ConditionPricing)
 */
export interface ConditionPricing {
  condition: GuitarCondition;
  averagePrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  listingCount: number;
  currency: string;
}

/**
 * Price snapshot at a specific date (matches C# PriceSnapshot)
 */
export interface PriceSnapshot {
  date: string;
  conditionPricing: ConditionPricing[];
  totalListingsScraped: number;
  scrapedAt: string;
}

// ==================== Main Guitar Interface ====================

/**
 * Complete guitar model (matches C# Guitar)
 */
export interface Guitar {
  id: string;
  brand: string;
  model: string;
  year: number | null;
  finish?: string | null;
  category?: string | null;
  specs?: GuitarSpecs | null;
  images?: string[] | null;
  priceHistory?: PriceSnapshot[] | null;
  createdAt: string;
  updatedAt: string;
}

// ==================== API Response Types ====================

/**
 * Paginated guitar list response
 */
export interface GuitarListResponse {
  total: number;
  skip: number;
  take: number;
  data: Guitar[];
}

/**
 * Search response
 */
export interface GuitarSearchResponse {
  query: string;
  count: number;
  data: Guitar[];
}

/**
 * Brand guitars response
 */
export interface BrandGuitarsResponse {
  brand: string;
  count: number;
  data: Guitar[];
}

/**
 * Price history response
 */
export interface PriceHistoryResponse {
  guitarId: string;
  brand: string;
  model: string;
  year: number | null;
  count: number;
  startDate?: string | null;
  endDate?: string | null;
  priceHistory: PriceSnapshot[];
}

// ==================== Utility Types ====================

/**
 * Guitar with optional fields (for partial updates)
 */
export type PartialGuitar = Partial<Guitar>;

/**
 * Guitar creation payload (without id and timestamps)
 */
export type CreateGuitarPayload = Omit<Guitar, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Guitar update payload (without id)
 */
export type UpdateGuitarPayload = Omit<PartialGuitar, 'id'>;

// ==================== Helper Functions ====================

/**
 * Get condition name from enum value
 */
export function getConditionName(condition: GuitarCondition): string {
  return ConditionNames[condition];
}

/**
 * Get condition color from enum value
 */
export function getConditionColor(condition: GuitarCondition): string {
  return ConditionColors[condition];
}

/**
 * Parse condition from string
 */
export function parseCondition(conditionStr: string): GuitarCondition | null {
  const normalized = conditionStr.replace(/\s+/g, '').toLowerCase();

  switch (normalized) {
    case 'brandnew':
      return GuitarCondition.BrandNew;
    case 'mint':
      return GuitarCondition.Mint;
    case 'excellent':
      return GuitarCondition.Excellent;
    case 'verygood':
      return GuitarCondition.VeryGood;
    case 'good':
      return GuitarCondition.Good;
    case 'fair':
      return GuitarCondition.Fair;
    case 'poor':
      return GuitarCondition.Poor;
    default:
      return null;
  }
}

/**
 * Get the latest price for a guitar across all conditions
 */
export function getLatestPrice(guitar: Guitar): { price: number | null; condition: string } {
  if (!guitar.priceHistory || guitar.priceHistory.length === 0) {
    return { price: null, condition: 'N/A' };
  }

  const latestSnapshot = guitar.priceHistory[0];

  for (const conditionPricing of latestSnapshot.conditionPricing) {
    if (conditionPricing.averagePrice !== null) {
      return {
        price: conditionPricing.averagePrice,
        condition: getConditionName(conditionPricing.condition)
      };
    }
  }

  return { price: null, condition: 'N/A' };
}

/**
 * Format price as USD currency
 */
export function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) {
    return 'N/A';
  }
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format date string
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Get price statistics for a specific condition across all snapshots
 */
export function getPriceStats(
  priceHistory: PriceSnapshot[],
  condition: GuitarCondition
): { min: number; max: number; avg: number; count: number } | null {
  const prices: number[] = [];

  for (const snapshot of priceHistory) {
    const conditionData = snapshot.conditionPricing.find(
      (cp) => cp.condition === condition && cp.averagePrice !== null
    );
    if (conditionData && conditionData.averagePrice !== null) {
      prices.push(conditionData.averagePrice);
    }
  }

  if (prices.length === 0) {
    return null;
  }

  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
    avg: prices.reduce((sum, p) => sum + p, 0) / prices.length,
    count: prices.length,
  };
}
