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

const TEXT_TRUNCATE_LENGTH = 200;

function ReviewCardContent({ review }: { review: Review }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const needsTruncation = review.review_text.length > TEXT_TRUNCATE_LENGTH;

  const displayText = isExpanded || !needsTruncation
    ? review.review_text
    : review.review_text.slice(0, TEXT_TRUNCATE_LENGTH) + '...';

  return (
    <CardContent className="p-6">
      <StarRating rating={review.rating} />
      <h3 className="font-semibold text-base mt-3 mb-1">{review.guitar_name}</h3>
      <p className="text-xs text-muted-foreground mb-3">
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
          className="mt-2 text-sm text-[#df5e15] hover:text-[#c54d0a] font-medium flex items-center gap-1"
        >
          {isExpanded ? (
            <>
              Show less <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              Read more <ChevronDown className="h-4 w-4" />
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? reviews.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === reviews.length - 1 ? 0 : prev + 1));
  };

  // Scroll to center the current review card
  useEffect(() => {
    if (containerRef.current && reviews.length > 0) {
      const cardWidth = 320; // Approximate card width (w-80 = 20rem = 320px)
      const gap = 16; // gap-4
      const spacerWidth = 16 + gap; // w-4 spacer + gap
      const containerWidth = containerRef.current.clientWidth;
      const cardPosition = spacerWidth + currentIndex * (cardWidth + gap);
      const scrollPosition = cardPosition - (containerWidth / 2) + (cardWidth / 2);

      containerRef.current.scrollTo({
        left: Math.max(0, scrollPosition),
        behavior: 'smooth'
      });
    }
  }, [currentIndex, reviews.length]);

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
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {reviews.length}
          </span>
          <button
            onClick={goToPrevious}
            className="p-2 rounded-full bg-card hover:bg-muted border border-border transition-colors"
            aria-label="Previous review"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={goToNext}
            className="p-2 rounded-full bg-card hover:bg-muted border border-border transition-colors"
            aria-label="Next review"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative">
        <div
          ref={containerRef}
          className="flex gap-4 overflow-x-auto px-2 py-4 scroll-smooth snap-x snap-mandatory scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* Spacer for left padding */}
          <div className="flex-shrink-0 w-4" aria-hidden="true" />
          {reviews.map((review, index) => (
            <Card
              key={review.id}
              className={`flex-shrink-0 w-80 snap-start transition-all duration-300 ${
                index === currentIndex
                  ? 'ring-2 ring-[#df5e15] shadow-lg'
                  : 'opacity-70'
              }`}
            >
              <ReviewCardContent review={review} />
            </Card>
          ))}
          {/* Spacer for right padding */}
          <div className="flex-shrink-0 w-4" aria-hidden="true" />
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-2 mt-4">
          {reviews.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-[#df5e15] w-4'
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Go to review ${index + 1}`}
            />
          ))}
        </div>

        {/* Show all reviews button */}
        <div className="flex justify-center mt-6">
          <Link
            href="/reviews"
            className="px-6 py-2 text-sm font-medium text-[#df5e15] hover:text-[#c54d0a] border border-[#df5e15] hover:border-[#c54d0a] rounded-lg transition-colors"
          >
            Show all reviews
          </Link>
        </div>
      </div>
    </div>
  );
}
