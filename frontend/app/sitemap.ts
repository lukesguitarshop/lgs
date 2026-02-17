import { MetadataRoute } from 'next';

interface Listing {
  id: string;
  listing_title: string;
  scraped_at: string;
  disabled?: boolean;
}

async function getListings(): Promise<Listing[]> {
  try {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';
    const res = await fetch(`${apiBaseUrl}/mylistings`, {
      next: { revalidate: 3600 }, // Revalidate every hour
    });

    if (!res.ok) {
      console.error('Failed to fetch listings for sitemap');
      return [];
    }

    return await res.json();
  } catch (error) {
    console.error('Error fetching listings for sitemap:', error);
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
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${siteUrl}/reviews`,
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
