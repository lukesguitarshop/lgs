/** The shop opened in 2022; the hero's "Years" figure counts from there. */
const FOUNDED_YEAR = 2022;

/** Reverb, eBay, Sweetwater Gear Exchange, Facebook Marketplace, and here. */
export const PLATFORM_COUNT = 5;

export interface ShopStats {
  soldCount: number;
  /** Null when the reviews service is unreachable, so the row can be dropped. */
  averageRating: number | null;
  years: number;
  platforms: number;
}

interface ReviewStatsResponse {
  total_count: number;
  average_rating: number;
}

/**
 * The numbers behind the hero card, the About copy and the sold heading.
 *
 * Each source degrades on its own: a dead reviews endpoint costs the rating row,
 * not the page. The sold count is passed in because the caller already fetches
 * the archive to render the strip.
 */
export async function getShopStats(soldCount: number): Promise<ShopStats> {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';
  let averageRating: number | null = null;

  try {
    // Ratings move slowly; an hour of cache costs nothing and spares the API.
    const res = await fetch(`${apiBaseUrl}/reviews/stats`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const stats: ReviewStatsResponse = await res.json();
      averageRating = typeof stats.average_rating === 'number' ? stats.average_rating : null;
    }
  } catch (error) {
    console.error('Error fetching review stats:', error);
  }

  return {
    soldCount,
    averageRating,
    years: new Date().getFullYear() - FOUNDED_YEAR,
    platforms: PLATFORM_COUNT,
  };
}
