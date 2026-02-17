'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { clearCart, refreshPendingCart } from '@/lib/cart';
import { useAuth } from '@/contexts/AuthContext';
import { getToken } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isAuthenticated, isGuest, isLoading: authLoading, setShowRegisterModal, setOnRegisterSuccess } = useAuth();
  const [isCompleting, setIsCompleting] = useState(true);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  useEffect(() => {
    // Wait for auth to load before running
    if (authLoading) return;
    // Prevent double-execution from React StrictMode
    if (hasCompleted) return;

    const completeCheckout = async () => {
      const sessionId = searchParams.get('session_id');
      const paypalOrderId = searchParams.get('paypal_order_id');

      // Check token directly since isAuthenticated may not be accurate yet
      const token = getToken();

      if (sessionId) {
        // Stripe checkout - complete the order (requires authentication)
        try {
          await api.authPost('/checkout/complete', { sessionId });
        } catch (err) {
          // Log but don't fail - order may already be completed
          console.warn('Checkout complete call:', err);
        }
      }
      // PayPal checkout - order already completed during capture, nothing to do

      // Clear the cart after checkout and dispatch event to update header
      clearCart();
      // Also refresh pending cart items (from accepted offers) in header
      refreshPendingCart();
      setIsCompleting(false);
      setHasCompleted(true);

      // Check if we should show the create account prompt
      // Only show for guests (no token) or guest users
      // Use token check since it's more reliable than isAuthenticated state
      if (!token || isGuest) {
        setShowCreateAccount(true);
      }
    };

    completeCheckout();
  }, [searchParams, isGuest, hasCompleted, authLoading]);

  const handleCreateAccount = () => {
    // Set callback to redirect to profile after successful registration
    // Wrap in extra function to prevent React from calling it as a state updater
    setOnRegisterSuccess(() => () => {
      router.push('/profile');
    });
    setShowRegisterModal(true);
  };

  return (
    <div className="max-w-2xl mx-auto text-center py-16 px-4">
      <div className="mb-8">
        <svg
          className="w-24 h-24 mx-auto text-green-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        Thank You for Your Order!
      </h1>

      <p className="text-xl text-gray-600 mb-8">
        Your payment was successful. You will receive an email confirmation shortly.
      </p>

      {/* Create Account Prompt for Guests */}
      {showCreateAccount && (
        <div className="mb-8 p-6 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center justify-center mb-3">
            <UserPlus className="h-6 w-6 text-[#df5e15] mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Create an Account</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Create an account to track your order, save your address for faster checkout,
            and get access to exclusive features like favorites and offers.
          </p>
          <Button
            onClick={handleCreateAccount}
            className="bg-[#df5e15] hover:bg-[#c74d12] text-white font-semibold px-6 py-2"
          >
            Create Account
          </Button>
        </div>
      )}

      <Link
        href="/"
        className="inline-block bg-[#df5e15] hover:bg-[#c74d12] text-white text-lg font-semibold px-8 py-4 rounded-lg transition-all"
      >
        Continue Shopping
      </Link>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto text-center py-16 px-4">Loading...</div>}>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
