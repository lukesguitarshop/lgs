import { notFound } from 'next/navigation';
import ListingDetail from './ListingDetail';

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

async function getListing(id: string): Promise<Listing | null> {
  try {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';
    const res = await fetch(`${apiBaseUrl}/listings/${id}`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      if (res.status === 404) {
        return null;
      }
      console.error('Failed to fetch listing:', res.status, res.statusText);
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error('Error fetching listing:', error);
    return null;
  }
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ListingPage({ params }: PageProps) {
  const { id } = await params;
  const listing = await getListing(id);

  if (!listing) {
    notFound();
  }

  return <ListingDetail listing={listing} />;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const listing = await getListing(id);

  if (!listing) {
    return {
      title: 'Listing Not Found | Guitar Shop',
    };
  }

  return {
    title: `${listing.listing_title} | Guitar Shop`,
    description: listing.description?.replace(/<[^>]*>/g, '').slice(0, 160) || 'View this guitar listing',
  };
}
