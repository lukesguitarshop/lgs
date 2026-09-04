'use client';

import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StateBlock } from '@/components/ui/state-block';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { api } from '@/lib/api';

// Reviews types and helpers
interface Review {
  id: string;
  guitar_name: string | null;
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

/**
 * Five crimson squares, not stars. The palette is four colours and gold is not one of
 * them; a filled square reads as a rating at 10px where a star turns to mush.
 */
function SquareRating({ rating, size = 10 }: { rating: number; size?: number }) {
  return (
    <div
      className="flex items-center gap-1"
      role="img"
      aria-label={`${rating} out of 5`}
    >
      {[...Array(5)].map((_, i) => (
        <span
          key={i}
          aria-hidden
          style={{ width: size, height: size }}
          className={
            i < rating
              ? 'block bg-primary'
              : 'block border-[1.5px] border-primary bg-transparent'
          }
        />
      ))}
    </div>
  );
}

/** "AUG 2026" — the mono meta line wants a short date, not a long one. */
function formatShortDate(dateString: string): string {
  return new Date(dateString)
    .toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
    .toUpperCase();
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="h-full border border-foreground/12 p-4">
      <div className="flex items-center gap-2.5">
        <SquareRating rating={review.rating} />
        <span className="label-mono-sm text-muted-foreground">
          {formatShortDate(review.review_date)}
        </span>
      </div>
      {review.guitar_name && (
        <h3 className="mt-2.5 text-base leading-[1.3] font-semibold text-foreground">
          {review.guitar_name}
        </h3>
      )}
      {review.review_text && (
        <p className="mt-2 text-[15px] leading-[1.5] text-foreground/78">
          {review.review_text}
        </p>
      )}
      <p className="label-mono-sm mt-3 text-muted-foreground">
        {review.reviewer_name}
      </p>
    </div>
  );
}

const TAB_ITEMS = [
  { value: 'about', label: 'About' },
  { value: 'return-policy', label: 'Returns' },
  { value: 'reviews', label: 'Reviews' },
  { value: 'contact', label: 'Contact' },
] as const;

const VALID_TABS: string[] = TAB_ITEMS.map(t => t.value);

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
          review.guitar_name?.toLowerCase().includes(query) ||
          review.reviewer_name?.toLowerCase().includes(query)
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
    return <div className="flex justify-center items-center min-h-[200px] text-foreground/70">Loading reviews...</div>;
  }

  if (error) {
    return (
      <div className="bg-primary p-4 text-primary-foreground">
        <p className="label-mono text-primary-foreground/70">Can&apos;t continue</p>
        <p className="mt-1.5 text-[15px]">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="label-mono mb-6 text-foreground/55">
        Showing {Math.min(displayCount, filteredReviews.length)} of {filteredReviews.length} review{filteredReviews.length !== 1 ? 's' : ''}
        {hasActiveFilters && ` · filtered from ${totalCount}`}
      </p>

      {stats && (
        <div className="mb-6 border border-foreground/12 p-4 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <p className="font-heading text-5xl leading-none text-foreground">
                {stats.average_rating.toFixed(1)}
              </p>
              <div>
                <SquareRating rating={Math.round(stats.average_rating)} size={12} />
                <p className="label-mono mt-2 text-muted-foreground">
                  {stats.total_count} reviews
                </p>
              </div>
            </div>
            <div className="flex gap-8 border-t border-foreground/12 pt-4 sm:border-0 sm:pt-0 sm:text-center">
              <div>
                <p className="font-heading text-2xl leading-none">{stats.total_count}</p>
                <p className="label-mono-sm mt-1.5 text-muted-foreground">Total</p>
              </div>
              <div>
                <p className="font-heading text-2xl leading-none">{stats.recent_count}</p>
                <p className="label-mono-sm mt-1.5 text-muted-foreground">Last 30 days</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/60" />
          <Input
            type="text"
            placeholder="Search by guitar or reviewer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-12 pl-11 text-base md:h-9 md:text-sm"
          />
        </div>
        <div className="flex gap-2 [&_button[role=combobox]]:h-12 md:[&_button[role=combobox]]:h-9">
          <Select value={dateFilter} onValueChange={(value: DateFilter) => setDateFilter(value)}>
            <SelectTrigger className="w-[140px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background">
              {dateFilterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
            <SelectTrigger className="w-[140px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background">
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
          <p className="text-foreground/70">
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
            <button
              type="button"
              onClick={loadMore}
              className="font-btn mt-6 flex h-12 w-full items-center justify-center border border-foreground text-[13px] text-foreground transition-colors hover:bg-foreground hover:text-background sm:mx-auto sm:w-auto sm:px-8"
            >
              Load {Math.min(REVIEWS_PER_PAGE, filteredReviews.length - displayCount)} more
            </button>
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
      <div className="mx-auto max-w-md py-8">
        <StateBlock variant="success" label="Sent">
          Message sent — I&apos;ll get back to you as soon as I can.
        </StateBlock>
        <button
          type="button"
          onClick={() => setSuccess(false)}
          className="font-btn mt-4 flex h-12 w-full items-center justify-center border border-foreground text-[13px] text-foreground transition-colors hover:bg-foreground hover:text-background"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <p className="text-foreground/80 mb-6">
        Have questions about a listing or looking for something specific? Fill out the form below and we'll get back to you as soon as possible.
      </p>

      {error && (
        <StateBlock variant="error" className="mb-6">{error}</StateBlock>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            Name <span className="text-primary">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Your name"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2">
            Email <span className="text-primary">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="your@email.com"
          />
        </div>

        <div>
          <label htmlFor="subject" className="block text-sm font-medium mb-2">
            Subject <span className="text-primary">*</span>
          </label>
          <input
            type="text"
            id="subject"
            name="subject"
            required
            className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="What's this about?"
          />
        </div>

        <div>
          <label htmlFor="message" className="block text-sm font-medium mb-2">
            Message <span className="text-primary">*</span>
          </label>
          <textarea
            id="message"
            name="message"
            required
            rows={5}
            className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            placeholder="Your message..."
          />
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3"
        >
          {isLoading ? 'Sending...' : 'Send Message'}
        </Button>
      </form>

      <p className="text-foreground/80 text-sm mt-6 text-center">
        You can also email us directly at{' '}
        <a href="mailto:lukesguitarshop@gmail.com" className="text-primary hover:text-primary/90 underline">
          lukesguitarshop@gmail.com
        </a>
      </p>
    </div>
  );
}

export default function ShopInfoPage() {
  // /shop-info?tab=reviews deep-links the Reviews tab — used by the review form's
  // confirmation and by the "see all reviews" links. Read after mount so the server and
  // client render the same default.
  const [tab, setTab] = useState('about');
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    // Deliberately in an effect: reading the URL during render would make the server
    // (always "about") and the client disagree and trip a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (requested && VALID_TABS.includes(requested)) setTab(requested);
  }, []);

  return (
    <div className="container mx-auto px-5 py-8 sm:px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-heading mb-6 text-3xl text-primary sm:text-5xl">
          Luke&apos;s Guitar Shop
        </h1>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          {/* Below sm the shadcn TabsList cannot work: its base class fixes it at h-9
              (36px) while four triggers wrap to two 34px rows, so Reviews and Contact
              fall out the bottom of the pill. A scrolling underline strip replaces it —
              a select would hide that the last two tabs exist and cost an extra tap. */}
          <div className="sticky top-[calc(var(--header-h)+2px)] z-30 -mx-5 mb-6 border-b border-foreground/12 bg-background sm:hidden">
            <div
              className="flex snap-x snap-mandatory gap-6 overflow-x-auto px-5"
              style={{ scrollbarWidth: 'none' }}
            >
              {TAB_ITEMS.map(item => (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.value}
                  onClick={() => setTab(item.value)}
                  className={`label-mono flex h-12 min-w-11 flex-none snap-start items-center justify-center border-b-2 whitespace-nowrap transition-colors ${
                    tab === item.value
                      ? 'border-primary text-primary'
                      : 'border-transparent text-foreground/55'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <TabsList className="mb-8 hidden w-full grid-cols-4 sm:grid">
            {TAB_ITEMS.map(item => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="about">
            <div className="prose prose-lg dark:prose-invert max-w-none">
              <p className="text-foreground/80 mb-6">
                Luke's Guitar Shop was founded in 2022 by Luke Walden, a guitar enthusiast turned full-time dealer with a passion for connecting players with quality pre-owned instruments.
              </p>

              <h2 className="mobile-h2 mt-8 mb-4 text-2xl font-semibold">Our Story</h2>
              <p className="text-foreground/80 mb-6">
                What started as a love for guitars has grown into a thriving online business dedicated to buying, selling, and trading used guitars. While we operate exclusively online for now, the dream of opening a physical storefront one day keeps us motivated and growing.
              </p>

              <h2 className="mobile-h2 mt-8 mb-4 text-2xl font-semibold">What We Offer</h2>
              <p className="text-foreground/80 mb-6">
                We specialize in pre-owned guitars, with a carefully curated selection that changes regularly. You'll also find amps, parts, and accessories listed from time to time. Every instrument is inspected and honestly described so you know exactly what you're getting.
              </p>

              <h2 className="mobile-h2 mt-8 mb-4 text-2xl font-semibold">Where to Find Us</h2>
              <p className="text-foreground/80 mb-6">
                You can find our listings on Reverb, eBay, Sweetwater Gear Exchange, and Facebook Marketplace—but your best price will always be right here on our shop page. We cut out the middleman fees and pass those savings directly to you.
              </p>

              <h2 className="mobile-h2 mt-8 mb-4 text-2xl font-semibold">Easy, Secure Checkout</h2>
              <p className="text-foreground/80 mb-6">
                Creating an account is quick and easy—just enter your email and you're ready to go. All payments are securely processed through Stripe or PayPal. Need a payment plan? PayPal Pay Later makes it easy to spread out your purchase.
              </p>

              <h2 className="mobile-h2 mt-8 mb-4 text-2xl font-semibold">Our Promise</h2>
              <p className="text-foreground/80 mb-6">
                Every purchase from Luke's Guitar Shop includes free shipping, fully covered by us. We believe in making the buying process as smooth and affordable as possible, so you can focus on what matters: finding your next great instrument.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="return-policy">
            <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
              <div>
                <h2 className="text-xl font-semibold mb-2">Payment</h2>
                <p className="text-foreground/80">Item is not reserved or considered sold until payment has fully cleared. Pending or unverified payments do not hold the item.</p>
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Pre-purchase Inspection</h2>
                <p className="text-foreground/80">All buyers are responsible for reviewing every photo and the full listing description before purchasing. Additional photos, measurements, or details are available on request — please ask before you buy, not after. Purchasing constitutes acknowledgment that you have reviewed the listing in full.</p>
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">All Sales Final</h2>
                <p className="text-foreground/80">Items are sold as-is. Cancellations are not accepted once payment has cleared. A 15% restocking fee applies to any cancelled order, regardless of shipping or tracking status, as preparation, packing, and handling begin immediately upon sale.</p>
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Returns</h2>
                <p className="text-foreground/80 mb-3">Returns are by approval only and must be requested within 24 hours of delivery. Approved returns are subject to:</p>
                <ul className="space-y-2 text-foreground/80 list-none pl-0">
                  <li className="flex items-start gap-3">
                    <span className="text-primary font-bold mt-0.5">—</span>
                    <span>A 15% restocking fee (non-negotiable)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-primary font-bold mt-0.5">—</span>
                    <span>Return in original condition with all original packaging and accessories</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-primary font-bold mt-0.5">—</span>
                    <span>Buyer-paid return shipping with full insurance and signature confirmation</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-primary font-bold mt-0.5">—</span>
                    <span>Refund issued only after the item is received and inspected</span>
                  </li>
                </ul>
                <p className="text-foreground/80 mt-3">Items returned damaged, incomplete, or without insurance are not eligible for refund.</p>
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Store Credit Purchases</h2>
                <p className="text-foreground/80">Guitars purchased using store credit are final sale and are not eligible for return under any circumstances. No exceptions will be made.</p>
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Condition Expectations</h2>
                <p className="text-foreground/80">You are purchasing a used instrument, not a professionally set-up guitar. Minor adjustments (intonation, action, tuning stability, etc.) are expected and are the buyer&apos;s responsibility. &ldquo;Used&rdquo; condition is not grounds for a return.</p>
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Communication</h2>
                <p className="text-foreground/80">Questions are welcome before purchase. Message me anytime — I&apos;d rather answer ten questions upfront than deal with a misunderstanding after the sale.</p>
              </div>
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
