'use client';

import Link from 'next/link';

export default function CheckoutCancelPage() {
  return (
    <div className="mx-auto max-w-2xl md:px-4 md:py-16 md:text-center">
      <h1 className="mobile-h1 text-4xl font-bold text-foreground">
        Checkout Cancelled
      </h1>

      <p className="mt-3 text-base leading-[1.5] text-foreground/65 md:text-xl">
        Your checkout was cancelled. Your cart items have been saved.
      </p>

      <div className="mt-6 grid gap-2 md:flex md:justify-center md:gap-4">
        <Link
          href="/cart"
          className="font-btn flex h-12 items-center justify-center bg-primary px-8 text-[13px] text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Return to Cart
        </Link>
        <Link
          href="/"
          className="font-btn flex h-12 items-center justify-center border border-foreground px-8 text-[13px] text-foreground transition-colors hover:bg-foreground hover:text-background"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
