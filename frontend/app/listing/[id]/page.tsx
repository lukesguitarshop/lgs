import { notFound } from 'next/navigation';
import ListingDetail from './ListingDetail';
import { ProductJsonLd } from './ProductJsonLd';

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
  disabled?: boolean;
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

  return (
    <>
      <ProductJsonLd listing={listing} />
      <ListingDetail listing={listing} />
    </>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const listing = await getListing(id);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lukesguitarshop.com';

  if (!listing) {
    return {
      title: 'Listing Not Found | Luke\'s Guitar Shop',
    };
  }

  const plainDescription = listing.description?.replace(/<[^>]*>/g, '').slice(0, 160) ||
    `${listing.listing_title} - Available now at Luke's Guitar Shop. Free shipping!`;
  const priceFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: listing.currency || 'USD',
    minimumFractionDigits: 0,
  }).format(listing.price);

  return {
    title: `${listing.listing_title} | Luke's Guitar Shop`,
    description: plainDescription,
    keywords: ['guitar', 'used guitar', 'buy guitar', listing.condition, listing.listing_title].filter(Boolean),
    openGraph: {
      title: `${listing.listing_title} - ${priceFormatted}`,
      description: plainDescription,
      url: `${siteUrl}/listing/${listing.id}`,
      siteName: "Luke's Guitar Shop",
      images: listing.images.length > 0 ? [
        {
          url: listing.images[0],
          width: 1200,
          height: 630,
          alt: listing.listing_title,
        }
      ] : undefined,
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${listing.listing_title} - ${priceFormatted}`,
      description: plainDescription,
      images: listing.images.length > 0 ? [listing.images[0]] : undefined,
    },
    alternates: {
      canonical: `${siteUrl}/listing/${listing.id}`,
    },
    robots: {
      index: !listing.disabled,
      follow: true,
    },
  };
}
