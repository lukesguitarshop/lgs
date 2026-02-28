'use client';

import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Star, Search, X } from 'lucide-react';
import { api } from '@/lib/api';

// Reviews types and helpers
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
        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{review.review_text}</p>
      </CardContent>
    </Card>
  );
}

const REVIEWS_PER_PAGE = 12;

// Reviews Tab Component
function ReviewsTab() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [displayCount, setDisplayCount] = useState(REVIEWS_PER_PAGE);
  const [stats, setStats] = useState<ReviewStats | null>(null);
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
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (review) =>
          review.guitar_name.toLowerCase().includes(query) ||
          review.reviewer_name.toLowerCase().includes(query)
      );
    }
    if (dateFilter !== 'all') {
      const days = parseInt(dateFilter, 10);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      result = result.filter((review) => new Date(review.review_date) >= cutoffDate);
    }
    result.sort((a, b) => {
      const dateA = new Date(a.review_date).getTime();
      const dateB = new Date(b.review_date).getTime();
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });
    return result;
  }, [reviews, searchQuery, dateFilter, sortBy]);

  useEffect(() => {
    setDisplayCount(REVIEWS_PER_PAGE);
  }, [searchQuery, dateFilter, sortBy]);

  const displayedReviews = filteredReviews.slice(0, displayCount);
  const hasMoreReviews = displayCount < filteredReviews.length;
  const loadMore = () => setDisplayCount((prev) => prev + REVIEWS_PER_PAGE);
  const hasActiveFilters = searchQuery || dateFilter !== 'all' || sortBy !== 'newest';
  const clearFilters = () => {
    setSearchQuery('');
    setDateFilter('all');
    setSortBy('newest');
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-[200px] text-muted-foreground">Loading reviews...</div>;
  }

  if (error) {
    return <div className="flex justify-center items-center min-h-[200px] text-red-600">{error}</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-muted-foreground">
          Showing {Math.min(displayCount, filteredReviews.length)} of {filteredReviews.length} review{filteredReviews.length !== 1 ? 's' : ''}
          {hasActiveFilters && ` (filtered from ${totalCount} total)`}
        </p>
      </div>

      {stats && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-6 w-6 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <div>
                  <p className="text-xl font-bold">5.0</p>
                  <p className="text-sm text-muted-foreground">Average Rating</p>
                </div>
              </div>
              <div className="flex gap-8 text-center">
                <div>
                  <p className="text-2xl font-bold">{stats.total_count}</p>
                  <p className="text-sm text-muted-foreground">Total Reviews</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.recent_count}</p>
                  <p className="text-sm text-muted-foreground">Last 30 Days</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
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
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dateFilterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
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
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            {hasActiveFilters ? 'No reviews match your filters.' : 'No reviews yet.'}
          </p>
          {hasActiveFilters && (
            <Button onClick={clearFilters} variant="outline" className="mt-4">Clear Filters</Button>
          )}
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedReviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
          {hasMoreReviews && (
            <div className="flex justify-center mt-6">
              <Button onClick={loadMore} variant="outline">
                Load More ({filteredReviews.length - displayCount} remaining)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Contact Tab Component
function ContactTab() {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const data = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      subject: formData.get('subject') as string,
      message: formData.get('message') as string,
    };

    try {
      await api.post('/contact', data);
      setSuccess(true);
      form.reset();
    } catch (err) {
      setError('Failed to send message. Please try again later.');
      console.error('Contact form error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="bg-green-100 dark:bg-green-900/30 border border-green-500 rounded-lg p-8 max-w-md mx-auto">
          <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <h2 className="text-2xl font-bold mb-2">Message Sent!</h2>
          <p className="text-muted-foreground mb-6">We'll get back to you as soon as possible.</p>
          <Button onClick={() => setSuccess(false)} className="bg-[#df5e15] hover:bg-[#c74d12]">
            Send Another Message
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <p className="text-muted-foreground mb-6">
        Have questions about a listing or looking for something specific? Fill out the form below and we'll get back to you as soon as possible.
      </p>

      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-500 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#df5e15] focus:border-transparent"
            placeholder="Your name"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#df5e15] focus:border-transparent"
            placeholder="your@email.com"
          />
        </div>

        <div>
          <label htmlFor="subject" className="block text-sm font-medium mb-2">
            Subject <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="subject"
            name="subject"
            required
            className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#df5e15] focus:border-transparent"
            placeholder="What's this about?"
          />
        </div>

        <div>
          <label htmlFor="message" className="block text-sm font-medium mb-2">
            Message <span className="text-red-500">*</span>
          </label>
          <textarea
            id="message"
            name="message"
            required
            rows={5}
            className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#df5e15] focus:border-transparent resize-none"
            placeholder="Your message..."
          />
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-[#df5e15] hover:bg-[#c74d12] text-white py-3"
        >
          {isLoading ? 'Sending...' : 'Send Message'}
        </Button>
      </form>

      <p className="text-muted-foreground text-sm mt-6 text-center">
        You can also email us directly at{' '}
        <a href="mailto:lukesguitarshop@gmail.com" className="text-[#df5e15] hover:text-[#c74d12] underline">
          lukesguitarshop@gmail.com
        </a>
      </p>
    </div>
  );
}

export default function ShopInfoPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-6">Luke's Guitar Shop</h1>

        <Tabs defaultValue="about" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-8">
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="return-policy">Return Policy</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
          </TabsList>

          <TabsContent value="about">
            <div className="prose prose-lg dark:prose-invert max-w-none">
              <p className="text-muted-foreground mb-6">
                Luke's Guitar Shop was founded in 2022 by Luke Walden, a guitar enthusiast turned full-time dealer with a passion for connecting players with quality pre-owned instruments.
              </p>

              <h2 className="text-2xl font-semibold mt-8 mb-4">Our Story</h2>
              <p className="text-muted-foreground mb-6">
                What started as a love for guitars has grown into a thriving online business dedicated to buying, selling, and trading used guitars. While we operate exclusively online for now, the dream of opening a physical storefront one day keeps us motivated and growing.
              </p>

              <h2 className="text-2xl font-semibold mt-8 mb-4">What We Offer</h2>
              <p className="text-muted-foreground mb-6">
                We specialize in pre-owned guitars, with a carefully curated selection that changes regularly. You'll also find amps, parts, and accessories listed from time to time. Every instrument is inspected and honestly described so you know exactly what you're getting.
              </p>

              <h2 className="text-2xl font-semibold mt-8 mb-4">Where to Find Us</h2>
              <p className="text-muted-foreground mb-6">
                You can find our listings on Reverb, eBay, Sweetwater Gear Exchange, and Facebook Marketplace—but your best price will always be right here on our shop page. We cut out the middleman fees and pass those savings directly to you.
              </p>

              <h2 className="text-2xl font-semibold mt-8 mb-4">Easy, Secure Checkout</h2>
              <p className="text-muted-foreground mb-6">
                Creating an account is quick and easy—just enter your email and you're ready to go. All payments are securely processed through Stripe or PayPal. Need a payment plan? PayPal Pay Later makes it easy to spread out your purchase.
              </p>

              <h2 className="text-2xl font-semibold mt-8 mb-4">Our Promise</h2>
              <p className="text-muted-foreground mb-6">
                Every purchase from Luke's Guitar Shop includes free shipping, fully covered by us. We believe in making the buying process as smooth and affordable as possible, so you can focus on what matters: finding your next great instrument.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="return-policy">
            <div className="prose prose-lg dark:prose-invert max-w-none">
              <ul className="space-y-4 text-muted-foreground list-none pl-0">
                <li className="flex items-start gap-3">
                  <span className="text-[#df5e15] font-bold">1.</span>
                  <span>Item isn't sold until payment clears.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#df5e15] font-bold">2.</span>
                  <span>Check all photos carefully before buying. Need more pics? Just ask.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#df5e15] font-bold">3.</span>
                  <span>Sold as-is, all sales final. That said, you have 24 hours from delivery to request a return if needed. Approved returns have a 15% restocking fee, must be in original condition with all packaging, and you cover return shipping with full insurance.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#df5e15] font-bold">4.</span>
                  <span>You're buying a used guitar, not a fresh setup—plan to adjust it yourself.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#df5e15] font-bold">5.</span>
                  <span>Questions? Message me anytime.</span>
                </li>
              </ul>
            </div>
          </TabsContent>

          <TabsContent value="reviews">
            <ReviewsTab />
          </TabsContent>

          <TabsContent value="contact">
            <ContactTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
