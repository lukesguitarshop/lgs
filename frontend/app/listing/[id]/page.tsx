import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import ListingDetail from './ListingDetail';
import { ProductJsonLd } from './ProductJsonLd';
import { BreadcrumbJsonLd } from './BreadcrumbJsonLd';
import {
  brandPath,
  extractBrand,
  feedCondition,
  formatPrice,
  getSiteUrl,
  isPurchasable,
  listingIdFromParam,
  listingMetaDescription,
  listingPath,
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
  // The segment is "<title-words>-<id>" now, and still the bare id on every link made
  // before that (emails, old Google results, the cart). Either way the id is the key.
  const { id: segment } = await params;
  const listing = await getListing(listingIdFromParam(segment));

  if (!listing) {
    notFound();
  }

  // One address per guitar: anything else (bare id, an old or mistyped title) is sent
  // permanently to the current one, so Google never sees the same page twice.
  const canonicalPath = listingPath(listing.id, listing.listing_title);
  if (`/listing/${segment}` !== canonicalPath) {
    permanentRedirect(canonicalPath);
  }

  const brand = extractBrand(listing.listing_title);

  return (
    <>
      <ProductJsonLd listing={listing} />
      <BreadcrumbJsonLd listing={listing} />
      <ListingDetail listing={listing} />
      {brand && (
        <p className="mx-auto max-w-[1320px] px-5 pb-10 text-[15px] text-foreground/70">
          More from this maker:{' '}
          <Link href={brandPath(brand)} className="underline hover:text-primary">
            used {brand} guitars
          </Link>
        </p>
      )}
    </>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { id: segment } = await params;
  const listing = await getListing(listingIdFromParam(segment));
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
      url: `${siteUrl}${listingPath(listing.id, listing.listing_title)}`,
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
      canonical: `${siteUrl}${listingPath(listing.id, listing.listing_title)}`,
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
