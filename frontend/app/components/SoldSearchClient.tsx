'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';

export interface SoldListing {
  id: string;
  listing_title: string;
  condition: string | null;
  images: string[];
  price: number;
  currency: string;
  scraped_at: string;
  listed_at: string | null;
}

interface SoldSearchClientProps {
  initialListings: SoldListing[];
}

// Sold listings carry no description (the API omits it to keep the archive light), so the
// grid stays readable at 10 per page.
const ITEMS_PER_PAGE = 10;

type SortOption = 'newest' | 'oldest' | 'price-low' | 'price-high' | 'alpha';

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'alpha', label: 'A to Z' },
];

function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function sortDate(listing: SoldListing): number {
  return new Date(listing.listed_at || listing.scraped_at).getTime();
}

export default function SoldSearchClient({ initialListings }: SoldSearchClientProps) {
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedConditions, setSelectedConditions] = useState<string[]>(
    searchParams.get('conditions')?.split(',').filter(Boolean) || []
  );
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [sortBy, setSortBy] = useState<SortOption>(
    (searchParams.get('sort') as SortOption) || 'newest'
  );
  const [currentPage, setCurrentPage] = useState(
    parseInt(searchParams.get('page') || '1', 10)
  );
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedConditions.length > 0) params.set('conditions', selectedConditions.join(','));
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (sortBy !== 'newest') params.set('sort', sortBy);
    if (currentPage > 1) params.set('page', currentPage.toString());

    // Deliberately the native history API rather than router.replace: router.replace makes an
    // RSC request, which re-runs the server component and re-fetches the whole sold archive —
    // once per keystroke while searching. replaceState keeps the URL shareable for free.
    const paramString = params.toString();
    window.history.replaceState(null, '', paramString ? `/sold?${paramString}` : '/sold');
  }, [searchQuery, selectedConditions, minPrice, maxPrice, sortBy, currentPage]);

  const availableConditions = useMemo(() => {
    const conditions = new Set(
      initialListings.map(l => l.condition).filter((c): c is string => Boolean(c))
    );
    return Array.from(conditions).sort();
  }, [initialListings]);

  const filteredListings = useMemo(() => {
    let result = initialListings;

    // Titles here carry make, model, year and finish, so they alone make a good search target.
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(listing =>
        listing.listing_title?.toLowerCase().includes(query)
      );
    }

    if (selectedConditions.length > 0) {
      result = result.filter(listing =>
        listing.condition && selectedConditions.includes(listing.condition)
      );
    }

    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);
    if (!isNaN(min)) {
      result = result.filter(listing => listing.price >= min);
    }
    if (!isNaN(max)) {
      result = result.filter(listing => listing.price <= max);
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'alpha':
          return a.listing_title.localeCompare(b.listing_title);
        case 'oldest':
          return sortDate(a) - sortDate(b);
        case 'newest':
        default:
          return sortDate(b) - sortDate(a);
      }
    });

    return result;
  }, [initialListings, searchQuery, selectedConditions, minPrice, maxPrice, sortBy]);

  const totalPages = Math.ceil(filteredListings.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedListings = filteredListings.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const hasActiveFilters =
    Boolean(searchQuery) || selectedConditions.length > 0 || Boolean(minPrice) ||
    Boolean(maxPrice) || sortBy !== 'newest';

  // A filter change can leave the reader stranded past the end of a shorter result set.
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedConditions([]);
    setMinPrice('');
    setMaxPrice('');
    setSortBy('newest');
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

  const filterControls = (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">Search</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search sold guitars..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="pl-10"
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Sold Price</label>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={minPrice}
            onChange={(e) => { setMinPrice(e.target.value); setCurrentPage(1); }}
            className="w-full"
            min="0"
          />
          <Input
            type="number"
            placeholder="Max"
            value={maxPrice}
            onChange={(e) => { setMaxPrice(e.target.value); setCurrentPage(1); }}
            className="w-full"
            min="0"
          />
        </div>
      </div>
      {availableConditions.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Condition</label>
          <div className="space-y-2">
            {availableConditions.map(condition => (
              <label key={condition} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedConditions.includes(condition)}
                  onChange={() => toggleCondition(condition)}
                  className="rounded border-gray-300 text-[#6E0114] focus:ring-[#6E0114]"
                />
                <span className="text-sm">{condition}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      {hasActiveFilters && (
        <Button onClick={clearFilters} variant="outline" className="w-full">
          <X className="h-4 w-4 mr-2" />
          Clear Filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <aside className="hidden lg:block lg:w-72 lg:sticky lg:top-4 lg:self-start">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-[#6E0114]" />
              <h2 className="text-lg font-semibold">Filters</h2>
            </div>
          </CardHeader>
          <CardContent>{filterControls}</CardContent>
        </Card>
      </aside>

      <main className="flex-1">
        {/* Mobile search + filter toggle. The main page routes to /filter for this; the sold
            archive keeps it inline so the fetched-once list is never re-requested. */}
        <div className="lg:hidden mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search sold guitars..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className={`pl-10 ${searchQuery ? 'pr-9' : ''} w-full`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            className="px-3"
            onClick={() => setShowMobileFilters(v => !v)}
            aria-expanded={showMobileFilters}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>
        {showMobileFilters && (
          <Card className="lg:hidden mb-4">
            <CardContent className="pt-6">{filterControls}</CardContent>
          </Card>
        )}

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-5xl mb-2 text-[#6E0114]">Sold Guitars</h1>
            <p className="text-muted-foreground">
              {filteredListings.length} guitar{filteredListings.length !== 1 ? 's' : ''}
              {hasActiveFilters ? ' (filtered)' : ' sold'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Sort:</span>
            <Select
              value={sortBy}
              onValueChange={(value: SortOption) => { setSortBy(value); setCurrentPage(1); }}
            >
              <SelectTrigger className="w-[180px] bg-[#FFFFF3] border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#FFFFF3] border-border">
                {sortOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredListings.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="text-6xl">🎸</div>
              <h2 className="text-2xl font-semibold">No sold guitars found</h2>
              <p className="text-muted-foreground">Try adjusting your search or filters.</p>
              {hasActiveFilters && (
                <Button onClick={clearFilters} variant="outline">Clear Filters</Button>
              )}
            </div>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
              {paginatedListings.map((listing, index) => (
                <SoldCard key={listing.id} listing={listing} priority={index < 3} />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-8 pb-8">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next<ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-4 text-center">
          <Link
            href="/"
            className="inline-flex items-center px-6 py-3 bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3] font-medium rounded-lg transition-colors"
          >
            Browse Available Guitars
          </Link>
        </div>
      </main>
    </div>
  );
}

function SoldCard({ listing, priority = false }: { listing: SoldListing; priority?: boolean }) {
  return (
    <Link href={`/listing/${listing.id}`} className="block h-full">
      <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col cursor-pointer">
        <div className="relative aspect-square bg-gradient-to-br from-muted to-muted/50">
          {listing.images && listing.images.length > 0 ? (
            <Image
              src={listing.images[0]}
              alt={listing.listing_title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
              priority={priority}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <span className="text-6xl">🎸</span>
            </div>
          )}
          <div className="absolute top-2 left-2 bg-[#6E0114] text-[#FFFFF3] text-xs font-bold px-2 py-1 rounded">
            SOLD
          </div>
          {listing.images && listing.images.length > 1 && (
            <div className="absolute bottom-2 right-2 bg-[#020E1C]/60 text-[#FFFFF3] text-xs px-2 py-1 rounded">
              +{listing.images.length - 1} photos
            </div>
          )}
        </div>
        <CardContent className="p-4 flex-grow flex flex-col">
          {listing.condition && (
            <p className="text-xs text-muted-foreground mb-1">{listing.condition}</p>
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
  );
}
