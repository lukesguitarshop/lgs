'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search,
  X,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
} from 'lucide-react';

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

// 12 divides evenly across the 2- and 3-column breakpoints, so pages end on a full row.
const ITEMS_PER_PAGE = 12;

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

// "Jul 2026" for the phone rows. Pinned to UTC so the server and the visitor's browser
// print the same month for a sale logged near midnight; otherwise the row would fail
// hydration whenever the two sit on opposite sides of a month boundary.
function formatSoldMonth(listing: SoldListing): string {
  return new Date(listing.listed_at || listing.scraped_at).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// The phone field: 48px and 16px text (16px is what stops iOS zooming on focus).
const phoneFieldClass =
  'h-12 w-full border border-foreground/35 bg-background px-3.5 text-base placeholder:text-foreground/50 focus:border-primary outline-none';

const phoneOutlineButtonClass =
  'font-btn flex w-full items-center justify-center gap-2 border border-foreground bg-background text-[13px] text-foreground transition-colors hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer';

const phonePagerButtonClass =
  'label-mono flex h-12 items-center justify-center border-[1.5px] border-foreground text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:border-foreground/20 disabled:text-foreground/35 cursor-pointer disabled:cursor-default';

export default function SoldSearchClient({ initialListings }: SoldSearchClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const hydratedRef = useRef(false);

  // Filters are restored from the URL here rather than with useSearchParams(). Reading that
  // hook opts this subtree out of server rendering, which left the whole sold grid out of the
  // indexed HTML — only a "Loading..." fallback was served. Defaults render on the server; a
  // shared link applies its filters immediately after hydration.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const q = params.get('q');
    // Deliberately in an effect: reading the URL during render would make the server (always
    // the defaults) and the client disagree and trip a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (q) setSearchQuery(q);

    const conditions = params.get('conditions')?.split(',').filter(Boolean);
    if (conditions?.length) setSelectedConditions(conditions);

    const min = params.get('minPrice');
    if (min) setMinPrice(min);

    const max = params.get('maxPrice');
    if (max) setMaxPrice(max);

    const sort = params.get('sort') as SortOption | null;
    if (sort) setSortBy(sort);

    const page = parseInt(params.get('page') || '1', 10);
    if (page > 1) setCurrentPage(page);
  }, []);

  useEffect(() => {
    // Skip the first pass so the initial render cannot wipe the params before they are read.
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }

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
  // Only what lives inside the phone filter panel counts towards its badge; search and
  // sort have their own controls in view.
  const panelFilterCount = selectedConditions.length + (minPrice || maxPrice ? 1 : 0);

  // A filter change can leave the reader stranded past the end of a shorter result set.
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      // The page comes from the URL as well as from clicks, so it is corrected here rather
      // than inside every filter setter.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const countLine = (
    <>
      {filteredListings.length} guitar{filteredListings.length !== 1 ? 's' : ''}
      {hasActiveFilters ? ' (filtered)' : ' sold'}
    </>
  );

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
                  className="accent-primary"
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
    <>
      {/* Phone composition (handoff 1h): h1 first, then the search, then dense rows. The
          archive is scanned for proof of sales rather than browsed, so rows beat a grid. */}
      <div className="md:hidden">
        <h1 className="font-heading text-[30px] leading-[0.98]">Sold guitars</h1>
        <p className="mt-2.5 text-base leading-[1.5] text-foreground/70">{countLine}</p>

        <input
          type="search"
          aria-label="Search the archive"
          placeholder="Search the archive"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          className={`mt-4 ${phoneFieldClass}`}
        />

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="relative">
            <select
              aria-label="Sort"
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value as SortOption); setCurrentPage(1); }}
              className="h-12 w-full appearance-none border border-foreground/35 bg-background px-3.5 pr-9 font-mono text-[11px] tracking-[0.12em] uppercase text-foreground outline-none focus:border-primary cursor-pointer"
            >
              {sortOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-primary"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowMobileFilters(v => !v)}
            aria-expanded={showMobileFilters}
            aria-controls={showMobileFilters ? 'sold-filters' : undefined}
            className={`h-12 ${phoneOutlineButtonClass}`}
          >
            Filters
            {panelFilterCount > 0 && (
              <span className="label-mono-sm bg-primary px-1.5 py-0.5 text-primary-foreground">
                {panelFilterCount}
              </span>
            )}
          </button>
        </div>

        {showMobileFilters && (
          <div id="sold-filters" className="mt-3 border border-foreground/20 p-4">
            <p className="label-mono mb-3 text-primary">Sold price</p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
              <input
                type="number"
                inputMode="numeric"
                min="0"
                aria-label="Minimum sold price"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => { setMinPrice(e.target.value); setCurrentPage(1); }}
                className={phoneFieldClass}
              />
              <span className="font-mono text-sm text-muted-foreground">to</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                aria-label="Maximum sold price"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => { setMaxPrice(e.target.value); setCurrentPage(1); }}
                className={phoneFieldClass}
              />
            </div>

            {availableConditions.length > 0 && (
              <>
                <p className="label-mono mt-6 mb-1 text-primary">Condition</p>
                {availableConditions.map(condition => (
                  <label
                    key={condition}
                    className="relative flex h-12 cursor-pointer items-center gap-3"
                  >
                    {/* The native box is kept for keyboard and screen-reader behaviour;
                        the 20px square beside it is what gets drawn. */}
                    <input
                      type="checkbox"
                      checked={selectedConditions.includes(condition)}
                      onChange={() => toggleCondition(condition)}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden
                      className="h-5 w-5 shrink-0 border-[1.5px] border-foreground/40 transition-colors peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background"
                    />
                    <Check
                      aria-hidden
                      strokeWidth={3}
                      className="pointer-events-none absolute top-1/2 left-[3px] h-3.5 w-3.5 -translate-y-1/2 text-primary-foreground opacity-0 peer-checked:opacity-100"
                    />
                    <span className="text-base">{condition}</span>
                  </label>
                ))}
              </>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="label-mono mt-4 flex h-11 w-full items-center justify-center text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {filteredListings.length === 0 ? (
          <div className="mt-6 border-[1.5px] border-foreground/20 p-5" role="status">
            <p className="label-mono text-primary">Nothing here</p>
            <p className="mt-2 text-[17px] leading-[1.3] font-semibold">No sold guitars match that.</p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className={`mt-4 h-12 ${phoneOutlineButtonClass}`}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mt-6 -mx-5 border-t border-foreground/15">
              {paginatedListings.map((listing, index) => (
                <Link
                  key={listing.id}
                  href={`/listing/${listing.id}`}
                  className="grid grid-cols-[88px_1fr] items-start gap-3.5 border-b border-foreground/12 px-5 py-3.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <div className="photo-panel relative aspect-[4/5] overflow-hidden border border-foreground/15">
                    {/* Eager rather than `priority`: the desktop grid already preloads its
                        first three, and a second preload of the same photo is pure waste. */}
                    {listing.images && listing.images.length > 0 && (
                      <Image
                        src={listing.images[0]}
                        alt={listing.listing_title}
                        fill
                        sizes="88px"
                        className="object-cover"
                        loading={index < 3 && currentPage === 1 ? 'eager' : 'lazy'}
                      />
                    )}
                  </div>
                  <div>
                    <p className="text-[15px] leading-[1.3] font-semibold text-pretty">
                      {listing.listing_title}
                    </p>
                    <div className="mt-2 flex items-baseline justify-between gap-3">
                      <span className="font-heading text-xl leading-none">
                        {formatPrice(listing.price, listing.currency)}
                      </span>
                      <span className="label-mono-sm shrink-0 text-muted-foreground">
                        {formatSoldMonth(listing)}
                      </span>
                    </div>
                    <p className="label-mono-sm mt-1.5 text-primary">Sold</p>
                  </div>
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="px-0 pt-5">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={phonePagerButtonClass}
                  >
                    &larr; Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={phonePagerButtonClass}
                  >
                    Next &rarr;
                  </button>
                </div>
                <p className="label-mono mt-3.5 text-center text-foreground/55">
                  Page {currentPage} of {totalPages}
                </p>
              </div>
            )}
          </>
        )}

        <Link href="/" className={`mt-8 h-13 ${phoneOutlineButtonClass}`}>
          Browse available guitars
        </Link>
      </div>

      {/* Desktop and tablet: today's composition, untouched. */}
      <div className="hidden md:flex flex-col lg:flex-row gap-6">
        <aside className="hidden lg:block lg:w-72 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-primary" />
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
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
              <h1 className="font-heading text-5xl mb-2 text-primary">Sold Guitars</h1>
              <p className="text-foreground/70">{countLine}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground/70">Sort:</span>
              <Select
                value={sortBy}
                onValueChange={(value: SortOption) => { setSortBy(value); setCurrentPage(1); }}
              >
                <SelectTrigger className="w-[180px] bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border-border">
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
                <p className="text-foreground/70">Try adjusting your search or filters.</p>
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
                  <div className="text-sm text-foreground/70">
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
              className="inline-flex items-center px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors"
            >
              Browse Available Guitars
            </Link>
          </div>
        </main>
      </div>
    </>
  );
}

function SoldCard({ listing, priority = false }: { listing: SoldListing; priority?: boolean }) {
  return (
    <Link href={`/listing/${listing.id}`} className="block h-full">
      <Card className="overflow-hidden h-full flex flex-col cursor-pointer">
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
          <div className="label-mono absolute top-2 left-2 bg-primary text-primary-foreground px-2 py-1">
            Sold
          </div>
          {listing.images && listing.images.length > 1 && (
            <div className="label-mono absolute bottom-2 right-2 bg-foreground/60 text-primary-foreground px-2 py-1">
              +{listing.images.length - 1} photos
            </div>
          )}
        </div>
        <CardContent className="p-4 flex-grow flex flex-col">
          {listing.condition && (
            <p className="label-mono-sm mb-1 text-primary">{listing.condition}</p>
          )}
          <h3 className="font-semibold text-sm line-clamp-2 mb-2 flex-grow">
            {listing.listing_title}
          </h3>
          <p className="text-lg font-bold text-foreground">
            {formatPrice(listing.price, listing.currency)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
