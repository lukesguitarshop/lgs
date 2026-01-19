'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Filter, X, SlidersHorizontal, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

interface Listing {
  id: string;
  listing_title: string;
  description: string | null;
  condition: string | null;
  images: string[];
  reverb_link: string | null;
  price: number;
  currency: string;
}

interface SearchClientProps {
  initialListings: Listing[];
}

const ITEMS_PER_PAGE = 12;

const conditionColors: Record<string, string> = {
  'Brand New': 'bg-green-500',
  'Mint': 'bg-emerald-500',
  'Excellent': 'bg-blue-500',
  'Very Good': 'bg-sky-500',
  'Good': 'bg-yellow-500',
  'Fair': 'bg-orange-500',
  'Poor': 'bg-red-500',
};

function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export default function SearchClient({ initialListings }: SearchClientProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);

  const availableConditions = useMemo(() => {
    const conditions = new Set(initialListings.map(l => l.condition).filter((c): c is string => Boolean(c)));
    return Array.from(conditions).sort();
  }, [initialListings]);

  const filteredListings = useMemo(() => {
    let result = initialListings;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(listing =>
        listing.listing_title?.toLowerCase().includes(query) ||
        listing.description?.toLowerCase().includes(query)
      );
    }
    if (selectedConditions.length > 0) {
      result = result.filter(listing =>
        listing.condition && selectedConditions.includes(listing.condition)
      );
    }
    return result;
  }, [initialListings, searchQuery, selectedConditions]);

  const totalPages = Math.ceil(filteredListings.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedListings = filteredListings.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const hasActiveFilters = searchQuery || selectedConditions.length > 0;

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedConditions([]);
    setCurrentPage(1);
  };

  const toggleCondition = (condition: string) => {
    setSelectedConditions(prev =>
      prev.includes(condition) ? prev.filter(c => c !== condition) : [...prev, condition]
    );
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <aside className={`lg:w-72 ${showFilters ? 'block' : 'hidden'} lg:block lg:sticky lg:top-4 lg:self-start`}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold">Filters</h2>
            </div>
            <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setShowFilters(false)}>
              <X className="h-5 w-5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search listings..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Condition</label>
              <div className="space-y-2">
                {availableConditions.map(condition => (
                  <label key={condition} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedConditions.includes(condition)}
                      onChange={() => toggleCondition(condition)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">{condition}</span>
                  </label>
                ))}
              </div>
            </div>
            {hasActiveFilters && (
              <Button onClick={clearFilters} variant="outline" className="w-full">
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      </aside>
      <main className="flex-1">
        <div className="lg:hidden mb-4">
          <Button onClick={() => setShowFilters(true)} variant="outline" className="w-full">
            <Filter className="h-4 w-4 mr-2" />
            Show Filters
          </Button>
        </div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">My Listings</h1>
          <p className="text-gray-600">
            {filteredListings.length} listing{filteredListings.length !== 1 ? 's' : ''}
            {hasActiveFilters && ' (filtered)'}
          </p>
        </div>
        {filteredListings.length === 0 && (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="text-6xl">🎸</div>
              <h2 className="text-2xl font-semibold">No listings found</h2>
              <p className="text-gray-600">Try adjusting your search or filters.</p>
              {hasActiveFilters && (
                <Button onClick={clearFilters} variant="outline">Clear Filters</Button>
              )}
            </div>
          </Card>
        )}
        {paginatedListings.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
              {paginatedListings.map(listing => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-8 pb-8">
                <div className="text-sm text-gray-600">Page {currentPage} of {totalPages}</div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" />Previous
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
                    Next<ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ListingCard({ listing }: { listing: Listing }) {
  const plainDescription = listing.description ? listing.description.replace(/<[^>]*>/g, '').trim() : '';

  return (
    <Link href={`/listing/${listing.id}`} className="block h-full">
      <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col cursor-pointer">
        <div className="relative w-full aspect-square bg-gradient-to-br from-gray-100 to-gray-200">
          {listing.images && listing.images.length > 0 ? (
            <Image src={listing.images[0]} alt={listing.listing_title} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <span className="text-6xl">🎸</span>
            </div>
          )}
          {listing.images && listing.images.length > 1 && (
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
              {listing.images.length} photos
            </div>
          )}
        </div>
        <CardContent className="flex flex-col flex-1 p-4">
          {listing.condition && (
            <p className="text-sm text-gray-500 mb-1">Used - {listing.condition}</p>
          )}
          <h3 className="font-semibold text-lg mb-2 line-clamp-2">{listing.listing_title}</h3>
          <p className="text-2xl font-bold text-gray-900 mb-1">
            {formatPrice(listing.price, listing.currency)}
          </p>
          <p className="text-sm text-green-600 mb-3">+ Free Shipping</p>
          <div className="mt-auto">
            <Button className="w-full bg-[#df5e15] hover:bg-[#c54d0a] text-white">
              View Details
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
