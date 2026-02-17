import { MetadataRoute } from 'next';

interface Listing {
  id: string;
  listing_title: string;
  scraped_at: string;
  disabled?: boolean;
}

async function getListings(): Promise<Listing[]> {
  // Use production API URL directly for server-side fetch
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    'https://guitar-price-api.fly.dev/api';

  try {
    const res = await fetch(`${apiBaseUrl}/listings`, {
      next: { revalidate: 3600 },
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
  ];

  // Dynamic listing pages (only active listings)
  const listingPages: MetadataRoute.Sitemap = listings
    .filter((listing) => !listing.disabled)
    .map((listing) => ({
      url: `${siteUrl}/listing/${listing.id}`,
      lastModified: new Date(listing.scraped_at),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));

  return [...staticPages, ...listingPages];
}
