'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, X, SlidersHorizontal, ChevronLeft, ChevronRight, ExternalLink, Heart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';

interface Listing {
  id: string;
  listing_title: string;
  description: string | null;
  condition: string | null;
  images: string[];
  reverb_link: string | null;
  price: number;
  currency: string;
  scraped_at: string;
  listed_at: string | null;
}

interface SearchClientProps {
  initialListings: Listing[];
}

const ITEMS_PER_PAGE = 12;

type SortOption = 'newest' | 'oldest' | 'price-low' | 'price-high' | 'alpha';

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'alpha', label: 'A to Z' },
];

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, setShowLoginModal } = useAuth();

  // Initialize state from URL params
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

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedConditions.length > 0) params.set('conditions', selectedConditions.join(','));
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (sortBy !== 'newest') params.set('sort', sortBy);
    if (currentPage > 1) params.set('page', currentPage.toString());

    const paramString = params.toString();
    const newUrl = paramString ? `?${paramString}` : '/';
    router.replace(newUrl, { scroll: false });
  }, [searchQuery, selectedConditions, minPrice, maxPrice, sortBy, currentPage, router]);

  const availableConditions = useMemo(() => {
    const conditions = new Set(initialListings.map(l => l.condition).filter((c): c is string => Boolean(c)));
    return Array.from(conditions).sort();
  }, [initialListings]);

  const filteredListings = useMemo(() => {
    let result = initialListings;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(listing =>
        listing.listing_title?.toLowerCase().includes(query) ||
        listing.description?.toLowerCase().includes(query)
      );
    }

    // Condition filter
    if (selectedConditions.length > 0) {
      result = result.filter(listing =>
        listing.condition && selectedConditions.includes(listing.condition)
      );
    }

    // Price range filter
    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);
    if (!isNaN(min)) {
      result = result.filter(listing => listing.price >= min);
    }
    if (!isNaN(max)) {
      result = result.filter(listing => listing.price <= max);
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
  }, [initialListings, searchQuery, selectedConditions, minPrice, maxPrice, sortBy]);

  const totalPages = Math.ceil(filteredListings.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedListings = filteredListings.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const hasActiveFilters = searchQuery || selectedConditions.length > 0 || minPrice || maxPrice || sortBy !== 'newest';

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

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Desktop filter sidebar - hidden on mobile */}
      <aside className="hidden lg:block lg:w-72 lg:sticky lg:top-4 lg:self-start">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold">Filters</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
              <label className="text-sm font-medium">Price Range</label>
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
        {/* Mobile filter button - links to dedicated filter page */}
        <div className="lg:hidden mb-4">
          <Link href={`/filter${searchParams.toString() ? `?${searchParams.toString()}` : ''}`}>
            <Button variant="outline" className="w-full">
              <Filter className="h-4 w-4 mr-2" />
              {hasActiveFilters ? 'Edit Filters' : 'Filter'}
            </Button>
          </Link>
        </div>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Listings</h1>
            <p className="text-muted-foreground">
              {filteredListings.length} listing{filteredListings.length !== 1 ? 's' : ''}
              {hasActiveFilters && ' (filtered)'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Sort:</span>
            <Select value={sortBy} onValueChange={(value: SortOption) => { setSortBy(value); setCurrentPage(1); }}>
              <SelectTrigger className="w-[180px] bg-white border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-border">
                {sortOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {filteredListings.length === 0 && (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="text-6xl">🎸</div>
              <h2 className="text-2xl font-semibold">No listings found</h2>
              <p className="text-muted-foreground">Try adjusting your search or filters.</p>
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
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  isFavorite={favoriteIds.has(listing.id)}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-8 pb-8">
                <div className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</div>
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

interface ListingCardProps {
  listing: Listing;
  isFavorite: boolean;
  onToggleFavorite: (listingId: string, e: React.MouseEvent) => void;
}

function ListingCard({ listing, isFavorite, onToggleFavorite }: ListingCardProps) {
  return (
    <Link href={`/listing/${listing.id}`} className="block h-full">
      <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col cursor-pointer">
        <div className="relative w-full aspect-square bg-gradient-to-br from-muted to-muted/50">
          {listing.images && listing.images.length > 0 ? (
            <Image src={listing.images[0]} alt={listing.listing_title} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <span className="text-6xl">🎸</span>
            </div>
          )}
          {listing.images && listing.images.length > 1 && (
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
              {listing.images.length} photos
            </div>
          )}
          {/* Favorite button */}
          <button
            onClick={(e) => onToggleFavorite(listing.id, e)}
            className={`absolute top-2 right-2 p-2 rounded-full transition-all cursor-pointer ${
              isFavorite
                ? 'bg-white text-red-500'
                : 'bg-white/80 text-gray-400 hover:text-red-500'
            }`}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        </div>
        <CardContent className="flex flex-col flex-1 p-4">
          {listing.condition && (
            <p className="text-sm text-muted-foreground mb-1">Used - {listing.condition}</p>
          )}
          <h3 className="font-semibold text-lg mb-2 line-clamp-2">{listing.listing_title}</h3>
          <p className="text-2xl font-bold text-foreground mb-1">
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
