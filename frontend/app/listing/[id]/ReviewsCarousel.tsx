'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { RatingSquares } from '@/components/ui/rating-squares';
import api from '@/lib/api';

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

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** "Aug 2026" — the phone review block only has room for month and year. */
function formatMonthYear(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

const TEXT_TRUNCATE_LENGTH = 150;

/** How many reviews the phone list shows before handing off to /reviews. */
const LIST_LENGTH = 3;

function useTruncatedText(text: string) {
  const [isExpanded, setIsExpanded] = useState(false);
  const needsTruncation = text.length > TEXT_TRUNCATE_LENGTH;
  const displayText = isExpanded || !needsTruncation ? text : text.slice(0, TEXT_TRUNCATE_LENGTH) + '...';
  return { isExpanded, setIsExpanded, needsTruncation, displayText };
}

function ReviewCardContent({ review }: { review: Review }) {
  const { isExpanded, setIsExpanded, needsTruncation, displayText } = useTruncatedText(review.review_text);

  return (
    <CardContent className="p-4">
      <RatingSquares rating={review.rating} size="sm" />
      {review.guitar_name && (
        <h3 className="font-semibold text-sm mt-2 mb-1 line-clamp-1">{review.guitar_name}</h3>
      )}
      <p className="label-mono-sm mb-2 text-muted-foreground">
        {review.reviewer_name} • {formatDate(review.review_date)}
      </p>
      <p className="text-sm text-foreground leading-relaxed">
        {displayText}
      </p>
      {needsTruncation && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="mt-1 flex min-h-11 items-center gap-1 text-[13px] font-semibold text-primary hover:text-primary/90"
        >
          {isExpanded ? (
            <>
              Show less <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              Read more <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
      )}
    </CardContent>
  );
}

/** One review in the phone list: squares and date on a row, headline, body, attribution. */
function ReviewListItem({ review }: { review: Review }) {
  const { isExpanded, setIsExpanded, needsTruncation, displayText } = useTruncatedText(review.review_text);

  return (
    <article className="border-b border-foreground/12 py-5">
      <div className="flex items-center justify-between">
        <RatingSquares rating={review.rating} size="sm" />
        <span className="label-mono-sm text-muted-foreground">{formatMonthYear(review.review_date)}</span>
      </div>
      {review.guitar_name && (
        <h3 className="mt-3 text-base font-semibold leading-[1.3]">{review.guitar_name}</h3>
      )}
      <p className="mt-2 text-[15px] leading-[1.5] text-foreground/78">{displayText}</p>
      {needsTruncation && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          className="label-mono flex h-12 cursor-pointer items-center text-primary"
        >
          {isExpanded ? 'Show less' : 'Read more'}
        </button>
      )}
      <p className="label-mono mt-3 text-foreground/55">{review.reviewer_name}</p>
    </article>
  );
}

interface ReviewsCarouselProps {
  /**
   * `carousel` is the desktop strip of cards with scroll arrows. `list` is the phone
   * treatment used inside the listing page's Reviews collapsible: the first three
   * reviews stacked as hairline-separated blocks, then a link to the full page.
   */
  variant?: 'carousel' | 'list';
}

export default function ReviewsCarousel({ variant = 'carousel' }: ReviewsCarouselProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchReviews() {
      try {
        const response = await api.get<ReviewsResponse>('/reviews?pageSize=25&sort=newest');
        // The carousel showcases written reviews; ratings-only feedback is shown on the shop info page
        setReviews(response.reviews.filter((r) => r.review_text?.trim()).slice(0, 10));
      } catch (err) {
        console.error('Error fetching reviews:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchReviews();
  }, []);

  const checkScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 10
    );
  };

  useEffect(() => {
    checkScrollButtons();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollButtons);
      window.addEventListener('resize', checkScrollButtons);
      return () => {
        container.removeEventListener('scroll', checkScrollButtons);
        window.removeEventListener('resize', checkScrollButtons);
      };
    }
  }, [reviews]);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 300; // card width + gap
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  if (variant === 'list') {
    return (
      <div>
        {loading ? (
          <p className="py-5 text-[15px] leading-[1.5] text-foreground/65">Loading reviews...</p>
        ) : (
          reviews.slice(0, LIST_LENGTH).map((review) => <ReviewListItem key={review.id} review={review} />)
        )}
        <Link
          href="/reviews"
          className="font-btn mt-5 flex h-12 items-center justify-center border border-foreground text-[13px] text-foreground transition-colors hover:bg-foreground hover:text-background"
        >
          View all reviews
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mt-12 pt-8 border-t border-border">
        <h2 className="text-xl font-bold mb-6">Customer Reviews</h2>
        <div className="flex justify-center items-center h-48">
          <div className="text-foreground/70">Loading reviews...</div>
        </div>
      </div>
    );
  }

  if (reviews.length === 0) {
    return null;
  }

  return (
    <div className="mt-12 pt-8 border-t border-border">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Customer Reviews</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className={`p-2 rounded-full border border-border transition-colors ${
              canScrollLeft
                ? 'bg-card hover:bg-muted cursor-pointer'
                : 'bg-muted/50 text-muted-foreground/50 cursor-not-allowed'
            }`}
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className={`p-2 rounded-full border border-border transition-colors ${
              canScrollRight
                ? 'bg-card hover:bg-muted cursor-pointer'
                : 'bg-muted/50 text-muted-foreground/50 cursor-not-allowed'
            }`}
            aria-label="Scroll right"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex gap-4 overflow-x-auto pb-4 scrollbar-none"
      >
        {reviews.map((review) => (
          <Card
            key={review.id}
            className="flex-shrink-0 w-72"
          >
            <ReviewCardContent review={review} />
          </Card>
        ))}
      </div>

      <div className="flex justify-center mt-6">
        <Link
          href="/reviews"
          className="flex h-12 items-center px-6 py-2 text-sm font-medium text-primary hover:text-primary/90 border border-primary hover:border-primary/90 rounded-lg transition-colors md:h-auto"
        >
          View all reviews
        </Link>
      </div>
    </div>
  );
}
