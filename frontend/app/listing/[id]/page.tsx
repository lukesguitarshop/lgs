import { notFound } from 'next/navigation';
import ListingDetail from './ListingDetail';
import { ProductJsonLd } from './ProductJsonLd';
import { BreadcrumbJsonLd } from './BreadcrumbJsonLd';
import {
  extractBrand,
  feedCondition,
  formatPrice,
  getSiteUrl,
  isPurchasable,
  listingMetaDescription,
} from '@/lib/seo';

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
  disabled?: boolean;
  /**
   * Reservation state. This fetch is unauthenticated, so the server always returns
   * the anonymous shape here — `reserved_for_me` is resolved client-side by
   * ListingDetail, which is also what keeps the holder's identity out of SSR/cache.
   */
  is_reserved?: boolean;
  reservation_badge?: string | null;
  reservation_message?: string | null;
  reserved_for_me?: boolean;
  accepts_offers?: boolean;
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
      <BreadcrumbJsonLd listing={listing} />
      <ListingDetail listing={listing} />
    </>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const listing = await getListing(id);
  const siteUrl = getSiteUrl();

  // Bare titles: the root layout's template appends " | Luke's Guitar Shop" once.
  if (!listing) {
    return {
      title: 'Listing not found',
    };
  }

  const description = listingMetaDescription(listing);
  const priceFormatted = formatPrice(listing.price, listing.currency);
  const brand = extractBrand(listing.listing_title);

  return {
    title: listing.listing_title,
    description,
    openGraph: {
      title: `${listing.listing_title} - ${priceFormatted}`,
      description,
      url: `${siteUrl}/listing/${listing.id}`,
      siteName: "Luke's Guitar Shop",
      images: listing.images.length > 0 ? [
        {
          url: listing.images[0],
          alt: listing.listing_title,
        }
      ] : undefined,
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${listing.listing_title} - ${priceFormatted}`,
      description,
      images: listing.images.length > 0 ? [listing.images[0]] : undefined,
    },
    alternates: {
      canonical: `${siteUrl}/listing/${listing.id}`,
    },
    robots: {
      index: !listing.disabled,
      follow: true,
    },
    // Read by Facebook, Pinterest and others to show price and stock on a shared link.
    other: {
      'product:price:amount': listing.price.toFixed(2),
      'product:price:currency': listing.currency || 'USD',
      'product:availability': isPurchasable(listing) ? 'in stock' : 'out of stock',
      'product:condition': feedCondition(listing.condition),
      ...(brand && { 'product:brand': brand }),
    },
  };
}
