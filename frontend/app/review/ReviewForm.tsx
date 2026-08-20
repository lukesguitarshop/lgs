'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Star, Loader2, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

/** Matches ReviewsController.MaxReviewLength. */
const MAX_LENGTH = 1000;

interface MyReview {
  id: string;
  rating: number;
  review_text: string | null;
  review_date: string;
}

export default function ReviewForm() {
  const { isAuthenticated, isLoading, setShowLoginModal } = useAuth();

  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [text, setText] = useState('');
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [hadExisting, setHadExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load any review already written so the form edits it rather than quietly
  // replacing it with a blank one.
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      setLoadingExisting(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const existing = await api.authGet<MyReview | null>('/reviews/mine');
        if (!cancelled && existing && existing.rating) {
          setRating(existing.rating);
          setText(existing.review_text ?? '');
          setHadExisting(true);
        }
      } catch {
        // No review yet, or the lookup failed — either way, start from a blank form.
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (rating < 1) {
      setError('Pick a star rating first.');
      return;
    }
    if (!text.trim()) {
      setError('Please write a few words about your experience.');
      return;
    }

    setSaving(true);
    try {
      await api.authPost('/reviews', { rating, reviewText: text.trim() });
      setSaved(true);
      setHadExisting(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || loadingExisting) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-xl border border-foreground/15 bg-card p-8 text-center">
        <h1 className="font-heading text-3xl">Leave a review</h1>
        <p className="mt-3 text-foreground/70">
          Sign in to your account and I&apos;ll add your review to the shop page.
        </p>
        <button
          type="button"
          onClick={() => setShowLoginModal(true)}
          className="font-btn mt-6 inline-flex min-h-[48px] items-center justify-center bg-primary px-6 text-primary-foreground transition-colors hover:bg-foreground cursor-pointer"
        >
          Sign in
        </button>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="mx-auto max-w-xl border border-foreground/15 bg-card p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <Check className="h-6 w-6 text-green-700" />
        </div>
        <h1 className="mt-4 font-heading text-3xl">Thank you</h1>
        <p className="mt-3 text-foreground/70">
          Your review is live on the shop page. It means a lot — thanks for taking the time.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/shop-info?tab=reviews"
            className="font-btn inline-flex min-h-[48px] items-center justify-center bg-primary px-6 text-primary-foreground transition-colors hover:bg-foreground cursor-pointer"
          >
            See all reviews
          </Link>
          <button
            type="button"
            onClick={() => setSaved(false)}
            className="font-btn inline-flex min-h-[48px] items-center justify-center border border-foreground px-6 text-foreground transition-colors hover:bg-foreground hover:text-background cursor-pointer"
          >
            Edit my review
          </button>
        </div>
      </div>
    );
  }

  const remaining = MAX_LENGTH - text.length;

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl border border-foreground/15 bg-card p-6 sm:p-8">
      <h1 className="font-heading text-3xl">
        {hadExisting ? 'Edit your review' : 'Leave a review'}
      </h1>
      <p className="mt-3 text-foreground/70">
        {hadExisting
          ? 'You’ve already written a review — updating it replaces what’s on the shop page.'
          : 'How did your order go? A star rating and a few words is all it takes.'}
      </p>

      {/* Rating */}
      <fieldset className="mt-8">
        <legend className="label-mono-sm mb-3 text-foreground/62">Your rating</legend>
        <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
          {[1, 2, 3, 4, 5].map(value => {
            const filled = value <= (hovered || rating);
            return (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                onMouseEnter={() => setHovered(value)}
                aria-label={`${value} star${value === 1 ? '' : 's'}`}
                aria-pressed={rating === value}
                className="p-1 transition-transform hover:scale-110 cursor-pointer"
              >
                <Star
                  className={`h-9 w-9 ${filled ? 'fill-primary text-primary' : 'text-foreground/25'}`}
                />
              </button>
            );
          })}
          <span className="ml-3 text-sm text-foreground/62">
            {rating > 0 ? `${rating} of 5` : 'Pick a rating'}
          </span>
        </div>
      </fieldset>

      {/* Comment */}
      <div className="mt-8">
        <label htmlFor="review-text" className="label-mono-sm mb-3 block text-foreground/62">
          Your review
        </label>
        <textarea
          id="review-text"
          value={text}
          onChange={e => setText(e.target.value.slice(0, MAX_LENGTH))}
          maxLength={MAX_LENGTH}
          rows={7}
          placeholder="How was the guitar, the packing, the communication?"
          className="w-full border border-foreground/35 bg-background p-3 text-[15px] leading-relaxed text-foreground outline-none transition-colors placeholder:text-foreground/40 focus:border-primary"
        />
        <div className="mt-2 flex justify-end">
          <span className={`font-mono text-xs ${remaining <= 50 ? 'text-primary' : 'text-foreground/50'}`}>
            {text.length}/{MAX_LENGTH}
          </span>
        </div>
      </div>

      {error && (
        <p className="mt-4 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="font-btn mt-6 inline-flex min-h-[52px] w-full items-center justify-center bg-primary px-6 text-primary-foreground transition-colors hover:bg-foreground disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
      >
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {hadExisting ? 'Update review' : 'Submit review'}
      </button>
    </form>
  );
}
