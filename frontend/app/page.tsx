import SearchClient, { type InitialFilters } from './components/SearchClient';
import Hero from './components/home/Hero';
import { type FeaturedListing } from './components/home/FeaturedGuitar';
import TrustBar from './components/home/TrustBar';
import About from './components/home/About';
import SoldStrip, { type SoldStripListing } from './components/home/SoldStrip';
import ContactCta from './components/home/ContactCta';
import TermsGrid from './components/home/TermsGrid';
import { getShopStats } from './components/home/shopStats';

interface Listing {
  id: string;
  listing_title: string;
  description: string | null;
  condition: string | null;
  images: string[];
  reverb_link: string | null;
  price: number;
  original_price: number | null;
  currency: string;
  scraped_at: string;
  listed_at: string | null;
}

async function getListings(): Promise<Listing[]> {
  try {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';
    const res = await fetch(`${apiBaseUrl}/listings`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error('Failed to fetch listings:', res.status, res.statusText);
      return [];
    }

    return await res.json();
  } catch (error) {
    console.error('Error fetching listings:', error);
    return [];
  }
}

/**
 * The archive backs both the sold strip and the "sold" figure in the hero card.
 * It only changes when something sells, so it is cached rather than fetched per visitor.
 */
async function getSoldListings(): Promise<SoldStripListing[]> {
  try {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';
    const res = await fetch(`${apiBaseUrl}/listings/sold`, {
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      console.error('Failed to fetch sold listings:', res.status, res.statusText);
      return [];
    }

    return await res.json();
  } catch (error) {
    console.error('Error fetching sold listings:', error);
    return [];
  }
}

type SortOption = InitialFilters['sort'];

const SORT_OPTIONS: SortOption[] = ['newest', 'oldest', 'price-low', 'price-high', 'alpha'];

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

/**
 * Filters are read here rather than in the client component: useSearchParams would
 * force a Suspense boundary around the grid, and that boundary leaves a duplicate
 * copy of it in the DOM.
 */
function parseFilters(params: Record<string, string | string[] | undefined>): InitialFilters {
  const sort = first(params.sort) as SortOption;
  const page = parseInt(first(params.page) || '1', 10);

  return {
    q: first(params.q),
    conditions: first(params.conditions).split(',').filter(Boolean),
    minPrice: first(params.minPrice),
    maxPrice: first(params.maxPrice),
    sort: SORT_OPTIONS.includes(sort) ? sort : 'newest',
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/**
 * The featured guitar, or null. The endpoint answers 204 when nothing is featured, and a
 * failure here costs the hero its featured slot rather than the page.
 */
async function getFeaturedListing(): Promise<FeaturedListing | null> {
  try {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';
    const res = await fetch(`${apiBaseUrl}/listings/featured`, { cache: 'no-store' });

    if (res.status === 204 || !res.ok) {
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error('Error fetching featured listing:', error);
    return null;
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [listings, soldListings, featured, params] = await Promise.all([
    getListings(),
    getSoldListings(),
    getFeaturedListing(),
    searchParams,
  ]);
  const stats = await getShopStats(soldListings.length);

  return (
    <>
      <Hero stats={stats} featured={featured} />
      <TrustBar />
      <SearchClient initialListings={listings} initialFilters={parseFilters(params)} />
      <About stats={stats} />
      <SoldStrip listings={soldListings.slice(0, 8)} totalSold={soldListings.length} />
      <ContactCta />
      <TermsGrid />
    </>
  );
}

export const metadata = {
  title: "Luke's Guitar Shop — Used and vintage guitars, 15 photos of the actual instrument",
  description:
    "A one-person shop in Ohio. Every listing has 14–15 photos of the guitar you're actually buying, every flaw disclosed, free insured shipping, case included on most. Payment plans and trade-ins.",
};
