'use client';

import Link from 'next/link';

export default function CheckoutCancelPage() {
  return (
    <div className="max-w-2xl mx-auto text-center py-16 px-4">
      <div className="mb-8">
        <svg
          className="w-24 h-24 mx-auto text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        Checkout Cancelled
      </h1>

      <p className="text-xl text-gray-600 mb-8">
        Your checkout was cancelled. Your cart items have been saved.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          href="/cart"
          className="inline-block bg-[#df5e15] hover:bg-[#c74d12] text-white text-lg font-semibold px-8 py-4 rounded-lg transition-all"
        >
          Return to Cart
        </Link>
        <Link
          href="/"
          className="inline-block bg-gray-200 hover:bg-gray-300 text-gray-800 text-lg font-semibold px-8 py-4 rounded-lg transition-all"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
