'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { clearCart, refreshPendingCart } from '@/lib/cart';
import { useAuth } from '@/contexts/AuthContext';
import { trackPurchase } from '@/lib/analytics';
import { StateBlock } from '@/components/ui/state-block';

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const { isLoading: authLoading } = useAuth();
  const [hasCompleted, setHasCompleted] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  useEffect(() => {
    // Wait for auth to load before running
    if (authLoading) return;
    // Prevent double-execution from React StrictMode
    if (hasCompleted) return;

    const completeCheckout = async () => {
      const sessionId = searchParams.get('session_id');
      const paypalOrderId = searchParams.get('paypal_order_id');

      if (sessionId) {
        // Stripe checkout - complete the order
        try {
          await api.authPost('/checkout/complete', { sessionId });
        } catch (err: unknown) {
          // Check if this is an "already processed" scenario (not an error)
          const errorMessage = err && typeof err === 'object' && 'message' in err
            ? (err as { message: string }).message
            : 'Unknown error';

          // If order already exists, that's fine - otherwise it's an error
          if (!errorMessage.includes('already processed')) {
            console.error('Checkout complete failed:', err);
            setOrderError(
              'Your payment was successful, but we had trouble processing your order. ' +
              'Please contact us at lukesguitarshop@gmail.com with your payment confirmation.'
            );
          }
        }
      }
      // PayPal checkout - order already completed during capture, nothing to do

      // Track purchase event in GA4
      const orderId = sessionId || paypalOrderId || 'unknown';
      const checkoutData = JSON.parse(sessionStorage.getItem('checkout_total') || '{}');
      trackPurchase(orderId, checkoutData.total || 0, checkoutData.currency || 'USD');
      sessionStorage.removeItem('checkout_total');

      // Clear the cart after checkout and dispatch event to update header
      clearCart();
      // Also refresh pending cart items (from accepted offers) in header
      refreshPendingCart();
      setHasCompleted(true);
    };

    completeCheckout();
  }, [searchParams, hasCompleted, authLoading]);

  // Checkout requires a signed-in account, so everyone who lands here already has one.
  // No "create an account" prompt: the only way to see one was being bounced to a
  // different origin where the session token was not visible.
  return (
    <div className="mx-auto max-w-2xl md:px-4 md:py-16 md:text-center">
      <svg
        className="h-12 w-12 text-primary md:mx-auto"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        {orderError ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        )}
      </svg>

      <h1 className="mobile-h1 mt-5 text-4xl font-bold text-foreground">
        {orderError ? 'Payment Received' : 'Thank You for Your Order!'}
      </h1>

      {orderError ? (
        <StateBlock variant="warning" className="mt-4 text-left">
          {orderError}
        </StateBlock>
      ) : (
        <p className="mt-3 text-base leading-[1.5] text-foreground/65 md:text-xl">
          Your payment was successful. You will receive an email confirmation shortly.
        </p>
      )}

      <div className="mt-6 grid gap-2 md:flex md:justify-center md:gap-4">
        <Link
          href="/profile"
          className="font-btn flex h-12 w-full items-center justify-center bg-primary px-8 text-[13px] text-primary-foreground transition-colors hover:bg-primary/90 md:inline-flex md:w-auto"
        >
          View My Orders
        </Link>
        <Link
          href="/"
          className="font-btn flex h-12 w-full items-center justify-center border border-foreground px-8 text-[13px] text-foreground transition-colors hover:bg-foreground hover:text-background md:inline-flex md:w-auto"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl py-16 text-center text-foreground/50 md:px-4">Loading...</div>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}
