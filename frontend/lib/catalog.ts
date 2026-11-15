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

/**
 * The shop also sells the odd case, pickup set and bridge. Those carry a maker's name
 * in the title, so without this they would be counted as that maker's guitars and
 * drag its price chart down to $50. Cheap *and* named like a part is the test: a
 * $149 guitar stays, and a $2,000 guitar "with hard case" is never looked at.
 */
const ACCESSORY_PRICE_CEILING = 275;
const ACCESSORY_WORDS =
  /\b(case|gig bag|pickups?|humbuckers?|tuners?|tuning machines?|bridge|saddles?|wiring harness|modeler|pickguard|knobs?|strap)\b/i;

export function isInstrument(listing: Pick<CatalogListing, 'listing_title' | 'price'>): boolean {
  return !(listing.price < ACCESSORY_PRICE_CEILING && ACCESSORY_WORDS.test(listing.listing_title));
}

/** Guitars for sale now. */
export async function getActiveListings(): Promise<CatalogListing[]> {
  return (await fetchList('/listings')).filter(
    (listing) => !listing.disabled && isInstrument(listing),
  );
}

/** Guitars the shop has sold, in the order the API returns them. */
export async function getSoldListings(): Promise<CatalogListing[]> {
  return (await fetchList('/listings/sold')).filter(isInstrument);
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

/** Listings bucketed by maker in one pass; listings with no recognised maker are dropped. */
export function groupByBrand(listings: CatalogListing[]): Map<string, CatalogListing[]> {
  const groups = new Map<string, CatalogListing[]>();
  for (const listing of listings) {
    const brand = extractBrand(listing.listing_title);
    if (!brand) continue;
    const group = groups.get(brand);
    if (group) group.push(listing);
    else groups.set(brand, [listing]);
  }
  return groups;
}

export interface PriceStats {
  low: number;
  high: number;
  /** At least half the listings went for this or less. */
  median: number;
}

export function priceStats(listings: CatalogListing[]): PriceStats | null {
  const prices = listings
    .map((listing) => listing.price)
    .filter((price) => price > 0)
    .sort((a, b) => a - b);
  if (prices.length === 0) return null;
  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 === 1 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
  return { low: prices[0], high: prices[prices.length - 1], median };
}

/** Fixed bands, so one brand's chart can be read against another's. */
const PRICE_BANDS: { label: string; below: number }[] = [
  { label: 'Under $750', below: 750 },
  { label: '$750 to $1,250', below: 1250 },
  { label: '$1,250 to $2,000', below: 2000 },
  { label: '$2,000 to $3,000', below: 3000 },
  { label: '$3,000 and up', below: Infinity },
];

export interface PriceBand {
  label: string;
  count: number;
}

export function priceBands(listings: CatalogListing[]): PriceBand[] {
  const bands = PRICE_BANDS.map((band) => ({ label: band.label, count: 0 }));
  for (const listing of listings) {
    if (!(listing.price > 0)) continue;
    bands[PRICE_BANDS.findIndex((band) => listing.price < band.below)].count += 1;
  }
  return bands;
}

/** The lead photo of each listing, in order, skipping listings without one. */
export function coverImages(listings: CatalogListing[], limit: number): string[] {
  const covers: string[] = [];
  for (const listing of listings) {
    if (listing.images?.[0]) covers.push(listing.images[0]);
    if (covers.length === limit) break;
  }
  return covers;
}
