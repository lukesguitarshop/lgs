'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ADMIN_CLASS, SELLER_CLASS } from '@/lib/adminHint';
import { isSellerRoute } from '@/lib/admin-nav';

// Enough copies that one group outruns any phone or laptop; `min-w-full` covers the rest.
const REPEATS = [0, 1, 2, 3];

function Group({ hidden }: { hidden?: boolean }) {
  return (
    <div
      aria-hidden={hidden || undefined}
      className="ship-marquee-group flex min-w-full shrink-0 items-center justify-around"
    >
      {REPEATS.map(i => (
        <span key={i} className="flex shrink-0 items-center">
          <span className="px-5 md:px-8">Free shipping on all US orders</span>
          <span className="text-[0.6em] opacity-70">★</span>
          <span className="ship-marquee-outline px-5 md:px-8">Insured · No minimum</span>
          <span className="text-[0.6em] opacity-70">★</span>
        </span>
      ))}
    </div>
  );
}

/**
 * The scrolling free-shipping band above the header, for visitors and customers. The
 * owner gets the "Signed in as admin" strip in its place.
 */
export default function FreeShippingBanner() {
  const { isAdmin, isSeller, isLoading } = useAuth();
  const pathname = usePathname();

  // Once auth has an answer it overrules the pre-paint guess (login, logout, stale hint).
  useEffect(() => {
    if (isLoading) return;
    document.documentElement.classList.toggle(ADMIN_CLASS, isAdmin);
    document.documentElement.classList.toggle(SELLER_CLASS, isSeller);
  }, [isAdmin, isSeller, isLoading]);

  if (isAdmin) return null;

  return (
    <Link
      href="/shop-info?tab=return-policy"
      aria-label="Free shipping on all US orders. Shipping and returns"
      // globals.css drops the band above a guest seller's portal, as it does for the owner.
      data-seller-route={isSellerRoute(pathname) ? '' : undefined}
      className="ship-marquee group block h-11 overflow-hidden bg-primary text-primary-foreground md:h-14 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <div
        aria-hidden
        className="font-heading flex h-full w-full items-center text-[22px] leading-none tracking-[0.03em] whitespace-nowrap md:text-[30px]"
      >
        <Group />
        <Group hidden />
      </div>
    </Link>
  );
}
