import { MetadataRoute } from 'next';
import { brandPath, listingPath } from '@/lib/seo';
import {
  getSoldListings,
  isIndexableBrand,
  summarizeBrands,
  type CatalogListing,
} from '@/lib/catalog';

interface Listing {
  id: string;
  listing_title: string;
  scraped_at: string;
  disabled?: boolean;
  original_price?: number | null;
}

async function getListings(): Promise<Listing[]> {
  // Use production API URL directly for server-side fetch
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    'https://guitar-price-api.fly.dev/api';

  try {
    const res = await fetch(`${apiBaseUrl}/listings`, {
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      console.error('Sitemap: Failed to fetch listings:', res.status);
      return [];
    }

    return await res.json();
  } catch (error) {
    console.error('Sitemap: Error fetching listings:', error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lukesguitarshop.com';
  const listings = await getListings();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${siteUrl}/shop-info`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${siteUrl}/sold`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${siteUrl}/return-policy`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${siteUrl}/trade-in`,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${siteUrl}/contact`,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ];

  // Dynamic listing pages (only active listings)
  const listingPages: MetadataRoute.Sitemap = listings
    .filter((listing) => !listing.disabled)
    .map((listing) => ({
      url: `${siteUrl}${listingPath(listing.id, listing.listing_title)}`,
      lastModified: new Date(listing.scraped_at),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));

  // Brand pages, limited to the ones with enough on them to be worth indexing.
  const active = listings.filter((listing) => !listing.disabled) as unknown as CatalogListing[];
  const brands = summarizeBrands(active, await getSoldListings()).filter(isIndexableBrand);
  const brandPages: MetadataRoute.Sitemap =
    brands.length === 0
      ? []
      : [
          { url: `${siteUrl}/guitars`, changeFrequency: 'weekly', priority: 0.7 },
          ...brands.map((summary) => ({
            url: `${siteUrl}${brandPath(summary.brand)}`,
            changeFrequency: 'weekly' as const,
            priority: summary.inStock > 0 ? 0.8 : 0.5,
          })),
        ];

  return [...staticPages, ...brandPages, ...listingPages];
}
