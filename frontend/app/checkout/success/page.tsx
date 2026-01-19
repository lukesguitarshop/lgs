'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function CheckoutSuccessPage() {
  useEffect(() => {
    // Clear the cart after successful checkout
    localStorage.removeItem('cart');
  }, []);

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

      <Link
        href="/search"
        className="inline-block bg-[#df5e15] hover:bg-[#c74d12] text-white text-lg font-semibold px-8 py-4 rounded-lg transition-all"
      >
        Continue Shopping
      </Link>
    </div>
  );
}
