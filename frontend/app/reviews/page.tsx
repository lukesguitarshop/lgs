'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Star, Search, X } from 'lucide-react';
import api from '@/lib/api';

interface Review {
  id: string;
  guitar_name: string;
  reviewer_name: string;
  review_date: string;
  rating: number;
  review_text: string;
}

interface ReviewsResponse {
  reviews: Review[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface ReviewStats {
  total_count: number;
  recent_count: number;
  recent_days: number;
  average_rating: number;
}

type DateFilter = 'all' | '30' | '90' | '180';
type SortOption = 'newest' | 'oldest';

const dateFilterOptions: { value: DateFilter; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: '30', label: 'Last 30 Days' },
  { value: '90', label: 'Last 90 Days' },
  { value: '180', label: 'Last 6 Months' },
];

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={`h-5 w-5 ${
            i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
          }`}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <Card className="h-full">
      <CardContent className="p-6">
        <StarRating rating={review.rating} />
        <h3 className="font-semibold text-lg mt-3 mb-1">{review.guitar_name}</h3>
        <p className="text-sm text-muted-foreground mb-3">
          {review.reviewer_name} • {formatDate(review.review_date)}
        </p>
        <p className="text-gray-700 leading-relaxed">{review.review_text}</p>
      </CardContent>
    </Card>
  );
}

const REVIEWS_PER_PAGE = 24;

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [displayCount, setDisplayCount] = useState(REVIEWS_PER_PAGE);
  const [stats, setStats] = useState<ReviewStats | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  useEffect(() => {
    async function fetchData() {
      try {
        const [reviewsResponse, statsResponse] = await Promise.all([
          api.get<ReviewsResponse>('/reviews?pageSize=200'),
          api.get<ReviewStats>('/reviews/stats?recentDays=30'),
        ]);
        setReviews(reviewsResponse.reviews);
        setTotalCount(reviewsResponse.total_count);
        setStats(statsResponse);
      } catch (err) {
        setError('Failed to load reviews');
        console.error('Error fetching reviews:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const filteredReviews = useMemo(() => {
    let result = [...reviews];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (review) =>
          review.guitar_name.toLowerCase().includes(query) ||
          review.reviewer_name.toLowerCase().includes(query)
      );
    }

    // Date filter
    if (dateFilter !== 'all') {
      const days = parseInt(dateFilter, 10);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      result = result.filter((review) => new Date(review.review_date) >= cutoffDate);
    }

    // Sort
    result.sort((a, b) => {
      const dateA = new Date(a.review_date).getTime();
      const dateB = new Date(b.review_date).getTime();
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [reviews, searchQuery, dateFilter, sortBy]);

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(REVIEWS_PER_PAGE);
  }, [searchQuery, dateFilter, sortBy]);

  const displayedReviews = filteredReviews.slice(0, displayCount);
  const hasMoreReviews = displayCount < filteredReviews.length;

  const loadMore = () => {
    setDisplayCount((prev) => prev + REVIEWS_PER_PAGE);
  };

  const hasActiveFilters = searchQuery || dateFilter !== 'all' || sortBy !== 'newest';

  const clearFilters = () => {
    setSearchQuery('');
    setDateFilter('all');
    setSortBy('newest');
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-lg text-muted-foreground">Loading reviews...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-lg text-red-600">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Customer Reviews</h1>
        <p className="text-muted-foreground">
          Showing {Math.min(displayCount, filteredReviews.length)} of {filteredReviews.length} review{filteredReviews.length !== 1 ? 's' : ''}
          {hasActiveFilters && ` (filtered from ${totalCount} total)`}
        </p>
      </div>

      {/* Statistics Section */}
      {stats && (
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-8 w-8 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <div>
                  <p className="text-2xl font-bold">5.0</p>
                  <p className="text-sm text-muted-foreground">Average Rating</p>
                </div>
              </div>
              <div className="flex gap-8 text-center">
                <div>
                  <p className="text-3xl font-bold">{stats.total_count}</p>
                  <p className="text-sm text-muted-foreground">Total Reviews</p>
                </div>
                <div>
                  <p className="text-3xl font-bold">{stats.recent_count}</p>
                  <p className="text-sm text-muted-foreground">Last 30 Days</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by guitar or reviewer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Select value={dateFilter} onValueChange={(value: DateFilter) => setDateFilter(value)}>
            <SelectTrigger className="w-[150px] bg-white border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white border-border">
              {dateFilterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
            <SelectTrigger className="w-[150px] bg-white border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white border-border">
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button onClick={clearFilters} variant="outline" size="icon">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {filteredReviews.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="text-6xl">⭐</div>
            <h2 className="text-2xl font-semibold">No reviews found</h2>
            <p className="text-muted-foreground">
              {hasActiveFilters
                ? 'Try adjusting your search or filters.'
                : 'Check back soon for customer reviews!'}
            </p>
            {hasActiveFilters && (
              <Button onClick={clearFilters} variant="outline">
                Clear Filters
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {displayedReviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
          {hasMoreReviews && (
            <div className="flex justify-center mt-8">
              <Button onClick={loadMore} variant="outline" size="lg">
                Load More Reviews ({filteredReviews.length - displayCount} remaining)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
