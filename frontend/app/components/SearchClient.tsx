'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Filter, X, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';
import { ListingCard, type ListingCardData } from '@/components/listing/ListingCard';
import {
  FilterSheet,
  filterBySearchAndPrice,
  filterByCondition,
  countByCondition,
  guitarCount,
  type FilterValue,
  type PricePreset,
} from '@/components/listing/FilterSheet';

interface Listing {
  id: string;
  listing_title: string;
  description: string | null;
  condition: string | null;
  images: string[];
  reverb_link: string | null;
  price: number;
  original_price: number | null;
  currency: string;
  scraped_at: string;
  listed_at: string | null;
  /** True when an active reservation holds this guitar. Never says who. */
  is_reserved?: boolean;
  /** "On Hold" or "Pending Trade-In". */
  reservation_badge?: string | null;
  reserved_for_me?: boolean;
}

/** Filter state lifted out of the URL by the server page. */
export interface InitialFilters {
  q: string;
  conditions: string[];
  minPrice: string;
  maxPrice: string;
  sort: SortOption;
  page: number;
}

interface SearchClientProps {
  initialListings: Listing[];
  initialFilters: InitialFilters;
}

const ITEMS_PER_PAGE = 25;

/** How many cards the phone shows before "See all". */
const COMPACT_COUNT = 2;

type SortOption = 'newest' | 'oldest' | 'price-low' | 'price-high' | 'alpha';

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'price-low', label: 'Price: low to high' },
  { value: 'price-high', label: 'Price: high to low' },
  { value: 'alpha', label: 'A to Z' },
];

/**
 * The design's quick price bands. They drive the same minPrice/maxPrice state the
 * numeric inputs below them do, so a chip and a typed range are interchangeable.
 */
const pricePresets: PricePreset[] = [
  { label: 'All', min: '', max: '' },
  { label: 'Under $1.5k', min: '', max: '1500' },
  { label: '$1.5k–2k', min: '1500', max: '2000' },
  { label: '$2k+', min: '2000', max: '' },
];

/** The API shape onto the shared card's camelCase one. */
function toCardData(listing: Listing): ListingCardData {
  return {
    id: listing.id,
    title: listing.listing_title,
    condition: listing.condition,
    images: listing.images,
    price: listing.price,
    originalPrice: listing.original_price,
    currency: listing.currency,
    isReserved: listing.is_reserved,
    reservationBadge: listing.reservation_badge,
    reservedForMe: listing.reserved_for_me,
  };
}

/** The active price range as a chip label: the matching band, else the typed bounds. */
function priceChipLabel(min: string, max: string): string {
  const preset = pricePresets.find(p => (p.min || p.max) && p.min === min && p.max === max);
  if (preset) return preset.label;
  if (min && max) return `$${min}–$${max}`;
  if (min) return `From $${min}`;
  return `Up to $${max}`;
}

export default function SearchClient({ initialListings, initialFilters }: SearchClientProps) {
  const router = useRouter();
  const { isAuthenticated, setShowLoginModal } = useAuth();

  // Seeded from the URL by the server page. Reading useSearchParams here instead would
  // force a Suspense boundary, and that boundary leaves a duplicate copy of the grid in
  // the DOM — the same defect b5d778b removed from /sold.
  const [searchQuery, setSearchQuery] = useState(initialFilters.q);
  const [selectedConditions, setSelectedConditions] = useState<string[]>(initialFilters.conditions);
  const [minPrice, setMinPrice] = useState(initialFilters.minPrice);
  const [maxPrice, setMaxPrice] = useState(initialFilters.maxPrice);
  const [sortBy, setSortBy] = useState<SortOption>(initialFilters.sort);
  const [currentPage, setCurrentPage] = useState(initialFilters.page);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  // Phone-only: the list opens with two cards and "See all"; this is the "See all" tap.
  const [expanded, setExpanded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Fetch user's favorites when authenticated
  useEffect(() => {
    const fetchFavorites = async () => {
      if (!isAuthenticated) {
        setFavoriteIds(new Set());
        return;
      }
      try {
        const favorites = await api.get<{ listingId: string }[]>('/favorites', {
          headers: getAuthHeaders(),
        });
        setFavoriteIds(new Set(favorites.map(f => f.listingId)));
      } catch {
        setFavoriteIds(new Set());
      }
    };
    fetchFavorites();
  }, [isAuthenticated]);

  const handleToggleFavorite = async (listingId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    const isFavorite = favoriteIds.has(listingId);
    try {
      if (isFavorite) {
        await api.delete(`/favorites/${listingId}`, {
          headers: getAuthHeaders(),
        });
        setFavoriteIds(prev => {
          const next = new Set(prev);
          next.delete(listingId);
          return next;
        });
      } else {
        await api.post(`/favorites/${listingId}`, null, {
          headers: getAuthHeaders(),
        });
        setFavoriteIds(prev => new Set(prev).add(listingId));
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  /** The current filter state as a query string; the URL mirrors it. */
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedConditions.length > 0) params.set('conditions', selectedConditions.join(','));
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (sortBy !== 'newest') params.set('sort', sortBy);
    if (currentPage > 1) params.set('page', currentPage.toString());
    return params.toString();
  }, [searchQuery, selectedConditions, minPrice, maxPrice, sortBy, currentPage]);

  // Keep the URL shareable as filters change. The hash is carried through so landing on
  // /#inventory doesn't lose the anchor the moment this runs.
  useEffect(() => {
    const hash = window.location.hash;
    router.replace(`/${queryString ? `?${queryString}` : ''}${hash}`, { scroll: false });
  }, [queryString, router]);

  const availableConditions = useMemo(() => {
    const conditions = new Set(initialListings.map(l => l.condition).filter((c): c is string => Boolean(c)));
    return Array.from(conditions).sort();
  }, [initialListings]);

  /**
   * Everything except the condition filter. The sidebar counts each condition against
   * this set, so the numbers narrow with the search and price but a checked box never
   * zeroes out its own count.
   */
  const listingsBeforeCondition = useMemo(
    () => filterBySearchAndPrice(initialListings, { q: searchQuery, minPrice, maxPrice }),
    [initialListings, searchQuery, minPrice, maxPrice]
  );

  const conditionCounts = useMemo(() => countByCondition(listingsBeforeCondition), [listingsBeforeCondition]);

  const filteredListings = useMemo(() => {
    const result = filterByCondition(listingsBeforeCondition, selectedConditions);

    // Sort
    return [...result].sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'alpha':
          return a.listing_title.localeCompare(b.listing_title);
        case 'oldest':
          const aOldest = new Date(a.listed_at || a.scraped_at).getTime();
          const bOldest = new Date(b.listed_at || b.scraped_at).getTime();
          return aOldest - bOldest;
        case 'newest':
        default:
          const aNewest = new Date(a.listed_at || a.scraped_at).getTime();
          const bNewest = new Date(b.listed_at || b.scraped_at).getTime();
          return bNewest - aNewest;
      }
    });
  }, [listingsBeforeCondition, selectedConditions, sortBy]);

  const totalPages = Math.ceil(filteredListings.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedListings = filteredListings.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const hasActiveFilters = Boolean(
    searchQuery || selectedConditions.length > 0 || minPrice || maxPrice || sortBy !== 'newest'
  );
  /** Filters that narrow the list. Sort only reorders it, so it does not count here. */
  const hasListFilters = Boolean(searchQuery || selectedConditions.length > 0 || minPrice || maxPrice);
  /** What the chips and the Filter badge show. Search is visible in its own input. */
  const activeFilterCount = selectedConditions.length + (minPrice || maxPrice ? 1 : 0);

  // The phone's compact list: two cards and "See all". Any narrowing filter, a deep-linked
  // page, or a list too short to hide anything shows the full paginated list instead.
  const compact =
    !hasListFilters && !expanded && currentPage === 1 && filteredListings.length > COMPACT_COUNT;
  const onLastPage = currentPage >= totalPages;

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

  const applyPricePreset = (min: string, max: string) => {
    setMinPrice(min);
    setMaxPrice(max);
    setCurrentPage(1);
  };

  const applySheet = (next: FilterValue) => {
    setSearchQuery(next.q);
    setSelectedConditions(next.conditions);
    setMinPrice(next.minPrice);
    setMaxPrice(next.maxPrice);
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fieldClass =
    'w-full border border-foreground/35 bg-background px-3.5 py-3 text-[14.5px] text-foreground outline-none transition-colors placeholder:text-foreground/40 focus:border-primary';
  const phoneFieldClass =
    'h-12 w-full border border-foreground/35 bg-background px-3.5 text-base text-foreground outline-none placeholder:text-foreground/50 focus:border-primary';
  const focusRing = 'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
  const phonePageButtonClass = `flex h-12 items-center justify-center border border-foreground font-mono text-[11px] uppercase tracking-[0.12em] text-foreground disabled:cursor-not-allowed disabled:border-foreground/20 disabled:text-foreground/35 cursor-pointer ${focusRing}`;

  return (
    <section
      id="inventory"
      className="order-2 mx-auto max-w-[1320px] px-5 pt-8 pb-8 md:order-none md:pt-[clamp(48px,6vw,84px)] md:pb-[clamp(40px,5vw,64px)]"
    >
      {/* Phone header and controls (handoff 1b §3 / 1d): heading, then search, then sort +
          filter side by side. The full-width filter sheet does the rest. */}
      <div className="md:hidden">
        {compact ? (
          <div className="flex items-baseline justify-between">
            <h2 className="font-heading text-[26px] leading-none">In stock</h2>
            <span className="label-mono text-primary">{guitarCount(filteredListings.length)}</span>
          </div>
        ) : (
          <h2 className="font-heading text-[30px] leading-[0.98]">In stock now</h2>
        )}

        <input
          type="search"
          aria-label="Search listings"
          placeholder="Search by make, model, year"
          value={searchQuery}
          onChange={e => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className={`${phoneFieldClass} mt-4`}
        />

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="relative">
            <select
              aria-label="Sort"
              value={sortBy}
              onChange={e => {
                setSortBy(e.target.value as SortOption);
                setCurrentPage(1);
              }}
              className="h-12 w-full appearance-none border border-foreground/35 bg-background px-3.5 pr-9 font-mono text-[11px] uppercase tracking-[0.12em] text-foreground outline-none focus:border-primary cursor-pointer"
            >
              {sortOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 text-primary"
            />
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-expanded={sheetOpen}
            aria-haspopup="dialog"
            className={`label-mono flex h-12 items-center justify-center gap-2 bg-foreground text-background cursor-pointer ${focusRing}`}
          >
            Filter
            {activeFilterCount > 0 && (
              <span className="bg-primary px-1.5 py-0.5 text-primary-foreground">{activeFilterCount}</span>
            )}
          </button>
        </div>

        {activeFilterCount > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedConditions.map(condition => (
              <span
                key={condition}
                className="label-mono flex h-11 items-center border border-primary bg-primary/8 pl-3 whitespace-nowrap text-primary"
              >
                {condition}
                <button
                  type="button"
                  onClick={() => toggleCondition(condition)}
                  aria-label={`Remove ${condition} filter`}
                  className={`flex h-11 w-11 items-center justify-center cursor-pointer ${focusRing}`}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </span>
            ))}
            {(minPrice || maxPrice) && (
              <span className="label-mono flex h-11 items-center border border-primary bg-primary/8 pl-3 whitespace-nowrap text-primary">
                {priceChipLabel(minPrice, maxPrice)}
                <button
                  type="button"
                  onClick={() => applyPricePreset('', '')}
                  aria-label={`Remove ${priceChipLabel(minPrice, maxPrice)} filter`}
                  className={`flex h-11 w-11 items-center justify-center cursor-pointer ${focusRing}`}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </span>
            )}
          </div>
        )}

        {!compact && (
          <p className="label-mono mt-4 text-foreground/55">
            Showing {filteredListings.length} of {initialListings.length}
          </p>
        )}
      </div>

      <FilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        listings={initialListings}
        value={{ q: searchQuery, conditions: selectedConditions, minPrice, maxPrice }}
        availableConditions={availableConditions}
        presets={pricePresets}
        onApply={applySheet}
      />

      <div className="mb-[clamp(26px,3vw,38px)] hidden flex-wrap items-end justify-between gap-6 md:flex">
        <div className="max-w-[60ch]">
          <h2 className="font-heading text-[clamp(30px,4.6vw,54px)]">
            {filteredListings.length} in stock right now
          </h2>
          <p className="mt-3.5 text-[clamp(15px,1.4vw,17px)] leading-[1.55] text-foreground/68">
            I only list what I&apos;d own. When something good comes through it goes up; when it
            doesn&apos;t, the shelf stays short. Everything here is photographed, graded, and ready
            to ship.
          </p>
        </div>
        <label className="label-mono flex items-center gap-2.5 whitespace-nowrap text-foreground/62">
          Sort
          <select
            value={sortBy}
            onChange={e => {
              setSortBy(e.target.value as SortOption);
              setCurrentPage(1);
            }}
            className="min-h-[44px] border border-foreground/35 bg-background px-3.5 py-2.5 font-mono text-[11px] tracking-[0.08em] text-foreground outline-none focus:border-primary cursor-pointer"
          >
            {sortOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Tablet search + filter, between md and the sidebar breakpoint. The filter button
          opens the same sheet the phone uses. */}
      <div className="mb-6 hidden gap-2 md:flex lg:hidden">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <input
            type="search"
            placeholder="Search listings..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className={`${fieldClass} pl-10`}
          />
        </div>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label="Filters"
          aria-expanded={sheetOpen}
          aria-haspopup="dialog"
          className="flex min-h-[46px] items-center justify-center border border-foreground/35 px-4 text-foreground transition-colors hover:border-primary hover:text-primary cursor-pointer"
        >
          <Filter className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-start gap-[clamp(24px,3vw,44px)]">
        <aside className="sticky top-[140px] hidden w-[232px] flex-none grid-cols-1 gap-[30px] border-t-2 border-primary pt-[22px] lg:grid">
          <div>
            <label htmlFor="q" className="label-mono-sm mb-2.5 block tracking-[0.18em] text-foreground/62">
              Search
            </label>
            <input
              id="q"
              type="search"
              placeholder="Gibson, PRS, flame top…"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className={fieldClass}
            />
          </div>

          <div>
            <p className="label-mono-sm mb-3 tracking-[0.18em] text-foreground/62">Price</p>
            <div className="flex flex-wrap gap-2">
              {pricePresets.map(preset => {
                const active = minPrice === preset.min && maxPrice === preset.max;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPricePreset(preset.min, preset.max)}
                    className={`min-h-[40px] border px-3.5 py-2.5 font-mono text-[11px] tracking-[0.08em] transition-colors cursor-pointer ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-foreground/30 text-foreground/75 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            {/* Kept alongside the presets so an exact range is still reachable. */}
            <div className="mt-2.5 flex gap-2">
              <input
                type="number"
                placeholder="Min"
                aria-label="Minimum price"
                value={minPrice}
                onChange={e => {
                  setMinPrice(e.target.value);
                  setCurrentPage(1);
                }}
                min="0"
                className={fieldClass}
              />
              <input
                type="number"
                placeholder="Max"
                aria-label="Maximum price"
                value={maxPrice}
                onChange={e => {
                  setMaxPrice(e.target.value);
                  setCurrentPage(1);
                }}
                min="0"
                className={fieldClass}
              />
            </div>
          </div>

          {availableConditions.length > 0 && (
            <div>
              <p className="label-mono-sm mb-3 tracking-[0.18em] text-foreground/62">Condition</p>
              <div className="grid gap-0.5">
                {availableConditions.map(condition => (
                  <label
                    key={condition}
                    className="flex min-h-[44px] cursor-pointer items-center justify-between gap-2.5 border-b border-foreground/14 py-[11px] text-[14.5px]"
                  >
                    <span className="flex items-center gap-[11px]">
                      <input
                        type="checkbox"
                        checked={selectedConditions.includes(condition)}
                        onChange={() => toggleCondition(condition)}
                        className="h-4 w-4 accent-primary"
                      />
                      {condition}
                    </span>
                    <span className="font-mono text-[11px] text-foreground/55">
                      {conditionCounts.get(condition) ?? 0}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="btn-mono min-h-[44px] w-full gap-2 border border-foreground/30 px-3.5 py-2.5 text-[11px] text-foreground hover:border-primary hover:text-primary cursor-pointer"
            >
              <X className="h-4 w-4" />
              Clear filters
            </button>
          )}

          <div className="border-t border-foreground/14 pt-[18px]">
            <p className="text-[13.5px] leading-[1.55] text-foreground/68">
              Not seeing it?{' '}
              <Link href="/contact" className="border-b border-primary text-foreground hover:text-primary cursor-pointer">
                Tell me what you&apos;re hunting for
              </Link>{' '}
              and I&apos;ll watch for it.
            </p>
          </div>
        </aside>

        <div className="min-w-0 flex-[999_1_480px]">
          {filteredListings.length === 0 ? (
            <div className="hidden border border-foreground/14 px-6 py-16 text-center md:block">
              <h3 className="font-heading text-2xl">Nothing matches that</h3>
              <p className="mt-3 text-[15px] text-foreground/68">
                Try a wider price range, or clear the filters and start again.
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="btn-mono mt-6 min-h-[46px] border border-foreground/35 px-5 py-3 text-[11px] text-foreground hover:border-primary hover:text-primary cursor-pointer"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* One grid for every width rather than a phone list beside a hidden desktop
                  copy: a second grid would double the DOM and its images, the defect
                  b5d778b removed from /sold. In the compact state the cards past the first
                  two are display:none below md instead. Their eager images still preload
                  there, but that is four photos at most, and the nineteen lazy ones behind
                  them never load. */}
              <div
                className={`grid grid-cols-1 gap-8 md:mt-0 md:grid-cols-[repeat(auto-fill,minmax(268px,1fr))] md:gap-[clamp(20px,2.4vw,32px)] ${
                  compact ? 'mt-6' : 'mt-5'
                }`}
              >
                {paginatedListings.map((listing, index) => (
                  <ListingCard
                    key={listing.id}
                    listing={toCardData(listing)}
                    isFavorite={favoriteIds.has(listing.id)}
                    onToggleFavorite={handleToggleFavorite}
                    priority={index < 6}
                    className={compact && index >= COMPACT_COUNT ? 'hidden md:block' : undefined}
                  />
                ))}
              </div>

              {compact && (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className={`font-btn mt-8 flex h-13 w-full items-center justify-center border border-foreground text-[13px] text-foreground md:hidden cursor-pointer ${focusRing}`}
                >
                  See all {guitarCount(filteredListings.length)} →
                </button>
              )}

              {!compact && totalPages > 1 && (
                <div className="mt-8 md:hidden">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={phonePageButtonClass}
                    >
                      ← Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={phonePageButtonClass}
                    >
                      Next →
                    </button>
                  </div>
                  <p className="label-mono mt-3.5 text-center text-foreground/55">
                    Page {currentPage} of {totalPages}
                  </p>
                </div>
              )}

              {totalPages > 1 && (
                <div className="mt-12 hidden items-center justify-between border-t border-foreground/14 pt-6 md:flex">
                  <div className="label-mono-sm text-foreground/62">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="btn-mono min-h-[46px] gap-1 border border-foreground/35 px-4 py-3 text-[11px] text-foreground hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-foreground/35 disabled:hover:text-foreground cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="btn-mono min-h-[46px] gap-1 border border-foreground/35 px-4 py-3 text-[11px] text-foreground hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-foreground/35 disabled:hover:text-foreground cursor-pointer"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Thin inventory (handoff 1d). The phone list never looks broken — it just ends
              here, whether the filters left nothing or the visitor reached the last page. */}
          {!compact && onLastPage && (
            <div className="mt-8 border-[1.5px] border-foreground/20 p-5 md:hidden">
              <p className="label-mono text-primary">Thin inventory</p>
              <p className="mt-2 text-[17px] leading-[1.3] font-semibold text-foreground">
                {hasListFilters
                  ? "That's everything matching those filters."
                  : "That's everything in stock right now."}
              </p>
              <p className="mt-2 text-[15px] leading-[1.5] text-foreground/70">
                Not seeing it? Tell me what you&apos;re hunting for and I&apos;ll watch for it.
              </p>
              <Link
                href="/contact"
                className={`font-btn mt-4 flex h-12 items-center justify-center border border-foreground text-[13px] text-foreground cursor-pointer ${focusRing}`}
              >
                Tell me what to look for
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
