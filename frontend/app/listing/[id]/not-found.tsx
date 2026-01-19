import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <div className="text-8xl mb-6">🎸</div>
      <h1 className="text-3xl font-bold mb-4">Listing Not Found</h1>
      <p className="text-gray-600 mb-8 max-w-md">
        Sorry, we couldn't find the listing you're looking for. It may have been removed or the link might be incorrect.
      </p>
      <Link href="/search">
        <Button>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Listings
        </Button>
      </Link>
    </div>
  );
}
