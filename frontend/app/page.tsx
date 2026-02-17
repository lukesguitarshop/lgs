import { Suspense } from 'react';
import SearchClient from './components/SearchClient';

interface Listing {
  id: string;
  listing_title: string;
  description: string | null;
  condition: string | null;
  images: string[];
  reverb_link: string | null;
  price: number;
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

export default async function HomePage() {
  const listings = await getListings();

  return (
    <div className="container mx-auto px-4 py-8">
      <Suspense fallback={<div className="text-center py-8">Loading...</div>}>
        <SearchClient initialListings={listings} />
      </Suspense>
    </div>
  );
}

export const metadata = {
  title: 'Luke\'s Guitar Shop',
  description: 'Browse my current guitar listings on Reverb.',
};
