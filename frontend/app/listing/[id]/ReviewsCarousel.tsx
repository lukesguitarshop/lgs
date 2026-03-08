'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Star, ChevronDown, ChevronUp } from 'lucide-react';
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

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
          }`}
        />
      ))}
    </div>
  );
}

const TEXT_TRUNCATE_LENGTH = 150;

function ReviewCardContent({ review }: { review: Review }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const needsTruncation = review.review_text.length > TEXT_TRUNCATE_LENGTH;

  const displayText = isExpanded || !needsTruncation
    ? review.review_text
    : review.review_text.slice(0, TEXT_TRUNCATE_LENGTH) + '...';

  return (
    <CardContent className="p-4">
      <StarRating rating={review.rating} />
      <h3 className="font-semibold text-sm mt-2 mb-1 line-clamp-1">{review.guitar_name}</h3>
      <p className="text-xs text-muted-foreground mb-2">
        {review.reviewer_name} • {formatDate(review.review_date)}
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {displayText}
      </p>
      {needsTruncation && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="mt-2 text-xs text-[#df5e15] hover:text-[#c54d0a] font-medium flex items-center gap-1"
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

export default function ReviewsCarousel() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchReviews() {
      try {
        const response = await api.get<ReviewsResponse>('/reviews?pageSize=10&sort=newest');
        setReviews(response.reviews);
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

  if (loading) {
    return (
      <div className="mt-12 pt-8 border-t border-border">
        <h2 className="text-xl font-bold mb-6">Customer Reviews</h2>
        <div className="flex justify-center items-center h-48">
          <div className="text-muted-foreground">Loading reviews...</div>
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
        className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {reviews.map((review) => (
          <Card
            key={review.id}
            className="flex-shrink-0 w-72 hover:shadow-lg transition-shadow"
          >
            <ReviewCardContent review={review} />
          </Card>
        ))}
      </div>

      <div className="flex justify-center mt-6">
        <Link
          href="/reviews"
          className="px-6 py-2 text-sm font-medium text-[#df5e15] hover:text-[#c54d0a] border border-[#df5e15] hover:border-[#c54d0a] rounded-lg transition-colors"
        >
          View all reviews
        </Link>
      </div>
    </div>
  );
}
