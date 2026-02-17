'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ArrowLeft, X, SlidersHorizontal } from 'lucide-react';

type SortOption = 'newest' | 'oldest' | 'price-low' | 'price-high' | 'alpha';

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'alpha', label: 'A to Z' },
];

const allConditions = [
  'Brand New',
  'Mint',
  'Excellent',
  'Very Good',
  'Good',
  'Fair',
  'Poor',
];

function FilterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

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

  const hasActiveFilters = searchQuery || selectedConditions.length > 0 || minPrice || maxPrice || sortBy !== 'newest';

  const toggleCondition = (condition: string) => {
    setSelectedConditions(prev =>
      prev.includes(condition) ? prev.filter(c => c !== condition) : [...prev, condition]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedConditions([]);
    setMinPrice('');
    setMaxPrice('');
    setSortBy('newest');
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedConditions.length > 0) params.set('conditions', selectedConditions.join(','));
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (sortBy !== 'newest') params.set('sort', sortBy);

    const paramString = params.toString();
    const newUrl = paramString ? `/?${paramString}` : '/';
    router.push(newUrl);
  };

  const goBack = () => {
    // Preserve existing filters when going back
    const params = new URLSearchParams();
    if (searchParams.get('q')) params.set('q', searchParams.get('q')!);
    if (searchParams.get('conditions')) params.set('conditions', searchParams.get('conditions')!);
    if (searchParams.get('minPrice')) params.set('minPrice', searchParams.get('minPrice')!);
    if (searchParams.get('maxPrice')) params.set('maxPrice', searchParams.get('maxPrice')!);
    if (searchParams.get('sort')) params.set('sort', searchParams.get('sort')!);
    if (searchParams.get('page')) params.set('page', searchParams.get('page')!);

    const paramString = params.toString();
    const newUrl = paramString ? `/?${paramString}` : '/';
    router.push(newUrl);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="sm" onClick={goBack}>
            <ArrowLeft className="h-5 w-5 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-blue-600" />
            <h1 className="text-lg font-semibold">Filters</h1>
          </div>
          <div className="w-16" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Filter Content */}
      <div className="p-4 pb-32">
        <div className="space-y-6">
          {/* Search */}
          <Card>
            <CardHeader className="pb-3">
              <h2 className="text-sm font-medium">Search</h2>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search listings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Price Range */}
          <Card>
            <CardHeader className="pb-3">
              <h2 className="text-sm font-medium">Price Range</h2>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Min</label>
                  <Input
                    type="number"
                    placeholder="$0"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    min="0"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Max</label>
                  <Input
                    type="number"
                    placeholder="No limit"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    min="0"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Condition */}
          <Card>
            <CardHeader className="pb-3">
              <h2 className="text-sm font-medium">Condition</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {allConditions.map(condition => (
                  <label key={condition} className="flex items-center gap-3 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={selectedConditions.includes(condition)}
                      onChange={() => toggleCondition(condition)}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-base">{condition}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Sort */}
          <Card>
            <CardHeader className="pb-3">
              <h2 className="text-sm font-medium">Sort By</h2>
            </CardHeader>
            <CardContent>
              <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                <SelectTrigger className="w-full bg-white border-border">
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
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 space-y-3">
        {hasActiveFilters && (
          <Button onClick={clearFilters} variant="outline" className="w-full bg-white">
            <X className="h-4 w-4 mr-2" />
            Clear All Filters
          </Button>
        )}
        <Button onClick={applyFilters} className="w-full bg-[#df5e15] hover:bg-[#c54d0a] text-white">
          Apply Filters
        </Button>
      </div>
    </div>
  );
}

export default function FilterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <FilterPageContent />
    </Suspense>
  );
}
