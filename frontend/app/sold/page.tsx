import SoldSearchClient, { type SoldListing } from '../components/SoldSearchClient';

// One request for the whole archive; search, filtering and paging all run client-side from it,
// so browsing pages never costs another API call.
async function getSoldListings(): Promise<SoldListing[]> {
  try {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';
    // The sold archive only changes when something sells, so it is cached rather than fetched
    // per visitor. Every page view inside that window costs no API call at all.
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

export default async function SoldPage() {
  const listings = await getSoldListings();

  // No Suspense boundary: the client component reads no async values, and wrapping it made
  // React stream a second copy of the whole grid into a hidden div.
  return (
    <div className="container mx-auto md:px-4 md:py-8">
      <SoldSearchClient initialListings={listings} />
    </div>
  );
}

export const metadata = {
  title: 'Sold guitars',
  description: 'Browse guitars that have been sold from Luke\'s Guitar Shop.',
};
