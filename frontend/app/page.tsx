import { Suspense } from 'react';
import SearchClient from './components/SearchClient';
import Hero from './components/home/Hero';
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

export default async function HomePage() {
  const [listings, soldListings] = await Promise.all([getListings(), getSoldListings()]);
  const stats = await getShopStats(soldListings.length);

  return (
    <>
      <Hero stats={stats} />
      <TrustBar />
      {/* SearchClient reads useSearchParams, which needs a boundary on a dynamic page.
          Only the inventory is wrapped — wrapping the whole page made React stream a
          second copy of the grid (see the /sold fix in b5d778b). */}
      <Suspense fallback={<div className="label-mono mx-auto max-w-[1320px] px-5 py-24 text-foreground/50">Loading inventory…</div>}>
        <SearchClient initialListings={listings} />
      </Suspense>
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
