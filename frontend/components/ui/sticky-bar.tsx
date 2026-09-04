'use client';

import { useEffect } from 'react';

import { cn } from '@/lib/utils';

interface StickyBarProps {
  children: React.ReactNode;
  /** Extra classes for the inner 64px row — typically a grid template. */
  className?: string;
}

/**
 * The phone-only sticky action bar: 64px, cream, a 2px crimson top rule, pinned to the
 * bottom of the viewport and padded for the home indicator on notched phones. Listing,
 * cart, checkout, contact and trade-in each put their single primary action in one.
 *
 * It is `fixed`, so while it is mounted the body grows matching bottom padding
 * (`body.has-sticky-bar` in globals.css) — that is what keeps the last line of the page
 * and the footer from disappearing behind it. Hidden from `md:` up; desktop keeps its
 * in-page buttons.
 */
export function StickyBar({ children, className }: StickyBarProps) {
  useEffect(() => {
    document.body.classList.add('has-sticky-bar');
    return () => {
      document.body.classList.remove('has-sticky-bar');
    };
  }, []);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-primary bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className={cn('flex h-16 items-center gap-3 px-5', className)}>{children}</div>
    </div>
  );
}
