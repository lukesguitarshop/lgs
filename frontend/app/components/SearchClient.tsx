'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Filter, X, ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';
import { addToCart, isInCart } from '@/lib/cart';
import { logAddToCart } from '@/lib/activity';
import { trackAddToCart } from '@/lib/analytics';
import { formatPrice } from '@/lib/format';

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
const pricePresets: { label: string; min: string; max: string }[] = [
  { label: 'All', min: '', max: '' },
  { label: 'Under $1.5k', min: '', max: '1500' },
  { label: '$1.5k–2k', min: '1500', max: '2000' },
  { label: '$2k+', min: '2000', max: '' },
];

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

  /** The current filter state as a query string, shared by the URL and the /filter link. */
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
  const listingsBeforeCondition = useMemo(() => {
    let result = initialListings;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(listing =>
        listing.listing_title?.toLowerCase().includes(query) ||
        listing.description?.toLowerCase().includes(query)
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

    return result;
  }, [initialListings, searchQuery, minPrice, maxPrice]);

  const conditionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const listing of listingsBeforeCondition) {
      if (listing.condition) {
        counts.set(listing.condition, (counts.get(listing.condition) ?? 0) + 1);
      }
    }
    return counts;
  }, [listingsBeforeCondition]);

  const filteredListings = useMemo(() => {
    let result = listingsBeforeCondition;

    if (selectedConditions.length > 0) {
      result = result.filter(listing =>
        listing.condition && selectedConditions.includes(listing.condition)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
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

    return result;
  }, [listingsBeforeCondition, selectedConditions, sortBy]);

  const totalPages = Math.ceil(filteredListings.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedListings = filteredListings.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const hasActiveFilters = Boolean(
    searchQuery || selectedConditions.length > 0 || minPrice || maxPrice || sortBy !== 'newest'
  );

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

  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fieldClass =
    'w-full border border-foreground/35 bg-background px-3.5 py-3 text-[14.5px] text-foreground outline-none transition-colors placeholder:text-foreground/40 focus:border-primary';

  return (
    <section id="inventory" className="mx-auto max-w-[1320px] px-5 pt-[clamp(48px,6vw,84px)] pb-[clamp(40px,5vw,64px)]">
      <div className="mb-[clamp(26px,3vw,38px)] flex flex-wrap items-end justify-between gap-6">
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

      {/* Mobile search + link through to the full filter screen */}
      <div className="mb-6 flex gap-2 lg:hidden">
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
        <Link
          href={`/filter${queryString ? `?${queryString}` : ''}`}
          className="flex min-h-[46px] items-center justify-center border border-foreground/35 px-4 text-foreground transition-colors hover:border-primary hover:text-primary cursor-pointer"
          aria-label="Filters"
        >
          <Filter className="h-4 w-4" />
        </Link>
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
            <div className="border border-foreground/14 px-6 py-16 text-center">
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
              <div className="grid grid-cols-[repeat(auto-fill,minmax(268px,1fr))] gap-[clamp(20px,2.4vw,32px)]">
                {paginatedListings.map((listing, index) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    isFavorite={favoriteIds.has(listing.id)}
                    onToggleFavorite={handleToggleFavorite}
                    priority={index < 6}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-12 flex items-center justify-between border-t border-foreground/14 pt-6">
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
        </div>
      </div>
    </section>
  );
}

interface ListingCardProps {
  listing: Listing;
  isFavorite: boolean;
  onToggleFavorite: (listingId: string, e: React.MouseEvent) => void;
  priority?: boolean;
}

function ListingCard({ listing, isFavorite, onToggleFavorite, priority = false }: ListingCardProps) {
  const isOnSale = Boolean(listing.original_price && listing.price < listing.original_price);
  const isReserved = Boolean(listing.is_reserved);
  const [inCart, setInCart] = useState(false);

  // localStorage is read after mount only: reading it during render would make the
  // server and client markup disagree.
  useEffect(() => {
    const sync = () => setInCart(isInCart(listing.id));
    sync();
    window.addEventListener('cartUpdated', sync);
    return () => window.removeEventListener('cartUpdated', sync);
  }, [listing.id]);

  const handleAddToCart = (e: React.MouseEvent) => {
    // The whole card is a link; keep the click from navigating.
    e.preventDefault();
    e.stopPropagation();
    if (isReserved || inCart) return;

    addToCart({
      id: listing.id,
      title: listing.listing_title,
      price: listing.price,
      currency: listing.currency,
      image: listing.images?.[0] || '',
    });
    logAddToCart(listing.id, listing.listing_title);
    trackAddToCart({
      id: listing.id,
      name: listing.listing_title,
      price: listing.price,
      currency: listing.currency,
    });
    setInCart(true);
  };

  const actionClass =
    'flex min-h-[42px] items-center justify-center border border-foreground bg-background px-3 text-center text-xs font-bold tracking-wider uppercase text-foreground transition-colors';

  return (
    <Link href={`/listing/${listing.id}`} className="block h-full">
      <Card className="flex h-full cursor-pointer flex-col overflow-hidden transition-shadow hover:shadow-lg">
        <div className="relative aspect-square w-full bg-gradient-to-br from-muted to-muted/50">
          {listing.images && listing.images.length > 0 ? (
            <Image src={listing.images[0]} alt={listing.listing_title} fill sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-cover" priority={priority} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <span className="text-6xl">🎸</span>
            </div>
          )}
          {listing.images && listing.images.length > 1 && (
            <div className="absolute right-2 bottom-2 rounded bg-[#020E1C]/70 px-2 py-1 text-xs text-[#FFFFF3]">
              {listing.images.length} photos
            </div>
          )}
          {/* ON SALE badge */}
          {isOnSale && !isReserved && (
            <div className="absolute top-2 left-2 rounded bg-[#6E0114] px-2 py-1 text-xs font-bold text-[#FFFFF3]">
              ON SALE
            </div>
          )}
          {/* Reservation badge. Reserved guitars stay browsable — the badge creates
              urgency — but never reveal who they're held for. */}
          {isReserved && (
            <div
              className={`absolute top-2 left-2 rounded px-2 py-1 text-xs font-bold uppercase ${
                listing.reserved_for_me
                  ? 'bg-green-500 text-white'
                  : 'bg-yellow-400 text-yellow-900'
              }`}
            >
              {listing.reserved_for_me
                ? 'On hold for you'
                : listing.reservation_badge || 'On Hold'}
            </div>
          )}
          {/* Favorite button */}
          <button
            onClick={(e) => onToggleFavorite(listing.id, e)}
            className={`absolute top-2 right-2 cursor-pointer rounded-full p-2 transition-all ${
              isFavorite
                ? 'bg-[#FFFFF3] text-red-500'
                : 'bg-[#FFFFF3]/80 text-gray-400 hover:text-red-500'
            }`}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        </div>
        <CardContent className="flex flex-1 flex-col p-4">
          {listing.condition && (
            <p className="font-body mb-1 text-sm text-[#B8B0A4]">Used - {listing.condition}</p>
          )}
          <h3 className="font-body mb-2 line-clamp-2 text-lg font-semibold text-[#020E1C]">{listing.listing_title}</h3>
          <div className="mb-1">
            {isOnSale ? (
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-[#6E0114]">
                  {formatPrice(listing.price, listing.currency)}
                </p>
                <p className="text-lg text-gray-400 line-through">
                  {formatPrice(listing.original_price!, listing.currency)}
                </p>
              </div>
            ) : (
              <p className="text-2xl font-bold text-foreground">
                {formatPrice(listing.price, listing.currency)}
              </p>
            )}
          </div>
          <p className="mb-3 text-sm text-green-600">+ Free Shipping</p>

          {/* Two halves. "View details" is a plain span, not a link: the whole card
              already navigates there, and nesting an anchor inside one is invalid. */}
          <div className="mt-auto grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={isReserved || inCart}
              className={`${actionClass} ${
                isReserved || inCart
                  ? 'cursor-not-allowed border-foreground/30 text-foreground/40'
                  : 'cursor-pointer hover:bg-foreground hover:text-background'
              }`}
            >
              {isReserved ? 'Reserved' : inCart ? 'In cart' : 'Add to Cart'}
            </button>
            <span className={`${actionClass} hover:bg-foreground hover:text-background`}>
              View Details
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
