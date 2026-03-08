import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

interface SoldListing {
  id: string;
  listing_title: string;
  description: string | null;
  condition: string | null;
  images: string[];
  price: number;
  currency: string;
}

async function getSoldListings(): Promise<SoldListing[]> {
  try {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';
    const res = await fetch(`${apiBaseUrl}/listings/sold`, {
      cache: 'no-store',
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

function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export default async function SoldPage() {
  const listings = await getSoldListings();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Sold Guitars</h1>
        <p className="text-muted-foreground">
          Browse guitars that have found new homes. {listings.length} guitars sold.
        </p>
      </div>

      {listings.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No sold listings yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {listings.map((listing) => (
            <Link key={listing.id} href={`/listing/${listing.id}`}>
              <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col cursor-pointer">
                <div className="relative aspect-square">
                  {listing.images && listing.images.length > 0 ? (
                    <Image
                      src={listing.images[0]}
                      alt={listing.listing_title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <span className="text-6xl">🎸</span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 bg-[#df5e15] text-white text-xs font-bold px-2 py-1 rounded">
                    SOLD
                  </div>
                  {listing.images && listing.images.length > 1 && (
                    <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                      +{listing.images.length - 1} photos
                    </div>
                  )}
                </div>
                <CardContent className="p-4 flex-grow flex flex-col">
                  {listing.condition && (
                    <p className="text-xs text-muted-foreground mb-1">
                      {listing.condition}
                    </p>
                  )}
                  <h3 className="font-semibold text-sm line-clamp-2 mb-2 flex-grow">
                    {listing.listing_title}
                  </h3>
                  <p className="text-lg font-bold text-muted-foreground">
                    {formatPrice(listing.price, listing.currency)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-12 text-center">
        <Link
          href="/"
          className="inline-flex items-center px-6 py-3 bg-[#df5e15] hover:bg-[#c54d0a] text-white font-medium rounded-lg transition-colors"
        >
          Browse Available Guitars
        </Link>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Sold Guitars | Luke\'s Guitar Shop',
  description: 'Browse guitars that have been sold from Luke\'s Guitar Shop.',
};
