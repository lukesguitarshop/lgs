'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Star, Loader2, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/format';

/** Matches ReviewsController.MaxReviewLength. */
const MAX_LENGTH = 1000;

interface OrderItem {
  listingTitle: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  totalAmount: number;
  currency: string;
  status: string;
  createdAt: string;
  itemCount: number;
  items: OrderItem[];
}

interface MyReview {
  id: string;
  order_id: string | null;
  guitar_name: string | null;
  rating: number;
  review_text: string | null;
  review_date: string;
}

/** What the dropdown shows for an order: the guitar, then when it was bought. */
function orderLabel(order: Order): string {
  const titles = order.items?.map(i => i.listingTitle).filter(Boolean) ?? [];
  const name =
    titles.length === 0
      ? `Order ${order.id.slice(-6)}`
      : titles.length === 1
        ? titles[0]
        : `${titles[0]} + ${titles.length - 1} more`;
  const when = new Date(order.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${name} — ${when}`;
}

export default function ReviewForm() {
  const { isAuthenticated, isLoading, setShowLoginModal } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [myReviews, setMyReviews] = useState<MyReview[]>([]);
  const [orderId, setOrderId] = useState('');
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [text, setText] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Orders and any reviews already written, so picking an order can show what was said
  // about it rather than quietly overwriting it.
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      setLoadingData(false);
      return;
    }

    let cancelled = false;
    (async () => {
      const [orderList, reviewList] = await Promise.all([
        api.authGet<Order[]>('/auth/orders').catch(() => [] as Order[]),
        api.authGet<MyReview[]>('/reviews/mine').catch(() => [] as MyReview[]),
      ]);
      if (cancelled) return;

      // Newest first: with one order, which is the usual case, it is already the right one.
      const sorted = [...(orderList ?? [])].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setOrders(sorted);
      setMyReviews(reviewList ?? []);

      // Arriving from an order page names the order, so the form opens on that one
      // instead of whichever was bought last. Read straight off the URL rather than
      // useSearchParams, which would need a Suspense boundary around the whole form.
      const requested = new URLSearchParams(window.location.search).get('order');
      const preselected = sorted.find(o => o.id === requested);
      if (preselected) setOrderId(preselected.id);
      else if (sorted.length > 0) setOrderId(sorted[0].id);
      setLoadingData(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading]);

  const existingForOrder = useMemo(
    () => myReviews.find(r => r.order_id === orderId) ?? null,
    [myReviews, orderId]
  );

  // Switching orders swaps in that order's review, or clears back to a blank form.
  useEffect(() => {
    if (!orderId) return;
    setRating(existingForOrder?.rating ?? 0);
    setText(existingForOrder?.review_text ?? '');
    setError(null);
  }, [orderId, existingForOrder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!orderId) {
      setError('Pick which order you’re reviewing.');
      return;
    }
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
      const saved = await api.authPost<MyReview>('/reviews', {
        rating,
        reviewText: text.trim(),
        orderId,
      });
      // Keep the local copy in step so switching orders and back shows the new text.
      setMyReviews(prev => [...prev.filter(r => r.order_id !== orderId), saved]);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || loadingData) {
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

  // A review names the guitar it is about, so there has to be an order behind it.
  if (orders.length === 0) {
    return (
      <div className="mx-auto max-w-xl border border-foreground/15 bg-card p-8 text-center">
        <h1 className="font-heading text-3xl">Leave a review</h1>
        <p className="mt-3 text-foreground/70">
          Reviews are tied to an order, and there aren&apos;t any on this account yet. If you bought
          as a guest or through another platform, email me and I&apos;ll sort it out.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="font-btn inline-flex min-h-[48px] items-center justify-center bg-primary px-6 text-primary-foreground transition-colors hover:bg-foreground cursor-pointer"
          >
            Browse guitars
          </Link>
          <a
            href="mailto:lukesguitarshop@gmail.com"
            className="font-btn inline-flex min-h-[48px] items-center justify-center border border-foreground px-6 text-foreground transition-colors hover:bg-foreground hover:text-background cursor-pointer"
          >
            Email Luke
          </a>
        </div>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="mx-auto max-w-xl border border-foreground/15 bg-card p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center bg-foreground">
          <Check className="h-6 w-6 text-background" />
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
            {orders.length > 1 ? 'Review another order' : 'Edit my review'}
          </button>
        </div>
      </div>
    );
  }

  const remaining = MAX_LENGTH - text.length;

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl border border-foreground/15 bg-card p-6 sm:p-8">
      <h1 className="font-heading text-3xl">
        {existingForOrder ? 'Edit your review' : 'Leave a review'}
      </h1>
      <p className="mt-3 text-foreground/70">
        {existingForOrder
          ? 'You’ve already reviewed this order — updating it replaces what’s on the shop page.'
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

      {/* Which order — names the guitar on the review, the way the Reverb ones do. */}
      <div className="mt-8">
        <label htmlFor="review-order" className="label-mono-sm mb-3 block text-foreground/62">
          Which order
        </label>
        <select
          id="review-order"
          value={orderId}
          onChange={e => setOrderId(e.target.value)}
          className="w-full border border-foreground/35 bg-background p-3 text-[15px] text-foreground outline-none transition-colors focus:border-primary cursor-pointer"
        >
          {orders.map(order => (
            <option key={order.id} value={order.id}>
              {orderLabel(order)}
            </option>
          ))}
        </select>
        {orders.length === 1 ? (
          <p className="mt-2 text-xs text-foreground/50">
            {formatPrice(orders[0].totalAmount, orders[0].currency)} · this is the only order on
            your account
          </p>
        ) : (
          <p className="mt-2 text-xs text-foreground/50">
            You can leave a separate review for each order.
          </p>
        )}
      </div>

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
        <p className="mt-4 bg-primary px-3 py-2 text-sm text-primary-foreground">{error}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="font-btn mt-6 inline-flex min-h-[52px] w-full items-center justify-center bg-primary px-6 text-primary-foreground transition-colors hover:bg-foreground disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
      >
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {existingForOrder ? 'Update review' : 'Submit review'}
      </button>
    </form>
  );
}
