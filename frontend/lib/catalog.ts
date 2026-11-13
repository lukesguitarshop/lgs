import { KNOWN_BRANDS, extractBrand } from './seo';

/**
 * Server-side reads of the catalogue for the brand pages. Both are cached for five
 * minutes: these pages are for search engines and browsing, and do not need to be
 * exact to the second the way a listing's own page does.
 */

export interface CatalogListing {
  id: string;
  listing_title: string;
  condition: string | null;
  images: string[];
  price: number;
  original_price?: number | null;
  currency: string;
  scraped_at: string;
  listed_at?: string | null;
  disabled?: boolean;
  is_reserved?: boolean;
  reservation_badge?: string | null;
}

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'https://guitar-price-api.fly.dev/api';
}

async function fetchList(path: string): Promise<CatalogListing[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}${path}`, { next: { revalidate: 300 } });
    if (!res.ok) {
      console.error(`Catalog: ${path} answered ${res.status}`);
      return [];
    }
    return await res.json();
  } catch (error) {
    console.error(`Catalog: could not fetch ${path}:`, error);
    return [];
  }
}

export async function getActiveListings(): Promise<CatalogListing[]> {
  return (await fetchList('/listings')).filter((listing) => !listing.disabled);
}

export function getSoldListings(): Promise<CatalogListing[]> {
  return fetchList('/listings/sold');
}

export interface BrandSummary {
  brand: string;
  inStock: number;
  sold: number;
}

/**
 * A brand page is only worth showing Google when it has something on it: a guitar
 * for sale, or enough of a sold record to be a real page rather than an empty shell.
 */
export const MIN_SOLD_TO_INDEX = 5;

export function isIndexableBrand(summary: BrandSummary): boolean {
  return summary.inStock > 0 || summary.sold >= MIN_SOLD_TO_INDEX;
}

/** Every brand the shop has stocked, most in stock first, then most sold. */
export function summarizeBrands(
  active: CatalogListing[],
  sold: CatalogListing[],
): BrandSummary[] {
  const counts = new Map<string, BrandSummary>();
  const bump = (listing: CatalogListing, key: 'inStock' | 'sold') => {
    const brand = extractBrand(listing.listing_title);
    if (!brand) return;
    const entry = counts.get(brand) ?? { brand, inStock: 0, sold: 0 };
    entry[key] += 1;
    counts.set(brand, entry);
  };
  active.forEach((listing) => bump(listing, 'inStock'));
  sold.forEach((listing) => bump(listing, 'sold'));

  return [...counts.values()].sort(
    (a, b) =>
      b.inStock - a.inStock ||
      b.sold - a.sold ||
      KNOWN_BRANDS.indexOf(a.brand) - KNOWN_BRANDS.indexOf(b.brand),
  );
}

export function listingsForBrand(listings: CatalogListing[], brand: string): CatalogListing[] {
  return listings.filter((listing) => extractBrand(listing.listing_title) === brand);
}
