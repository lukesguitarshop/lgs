'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ShoppingCart, Menu, X, Shield } from 'lucide-react';
import { getCartCount } from '@/lib/cart';
import { ProfileButton, MobileProfileButton } from '@/components/auth/ProfileButton';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Homepage sections are anchors; everything else is a real route. */
const navLinks = [
  { href: '/#inventory', label: 'Listings', primary: true },
  { href: '/sold', label: 'Sold', primary: false },
  { href: '/#about', label: 'About', primary: false },
  { href: '/shop-info', label: 'Shop info', primary: false },
];

/**
 * The phone menu sheet, grouped so crimson is spent only on the group labels and the
 * single trade-in call to action. The first group carries the heavier weight because
 * it is where people actually go; the trust pages sit lighter beneath it.
 */
const menuGroups = [
  {
    label: 'Shop',
    rowClass: 'h-13 text-[17px] font-semibold',
    items: [
      { href: '/#inventory', label: 'Listings' },
      { href: '/sold', label: 'Sold' },
      { href: '/favorites', label: 'Favourites' },
    ],
  },
  {
    label: 'Shop info',
    rowClass: 'h-12 text-base font-normal',
    items: [
      { href: '/#about', label: 'About Luke' },
      { href: '/shop-info?tab=return-policy', label: 'Shipping & returns' },
      { href: '/shop-info?tab=reviews', label: 'Reviews' },
      { href: '/contact', label: 'Contact' },
    ],
  },
];

const focusRing = 'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
const rowFocusRing = `${focusRing} focus-visible:ring-inset`;

/**
 * The logo PNG is square with the lockup floating inside ~18% transparent padding, so
 * `h-10 w-auto` would give 25px of artwork in a 40px box. This windows the ink instead:
 * a 62×40 viewport over a 64px render, offset to the lockup.
 */
function MobileLogo() {
  return (
    <span className="relative block h-10 w-[62px] shrink-0 overflow-hidden">
      <Image
        src="/images/logo-transparent.png"
        alt="Luke's Guitar Shop — Ohio"
        width={256}
        height={256}
        // Not `priority`: the desktop logo below already preloads this exact file, and
        // a second preload hint for the same URL buys nothing.
        loading="eager"
        className="absolute -top-[11px] -left-0.5 block h-16 w-16 max-w-none"
      />
    </span>
  );
}

export default function Header() {
  const [cartCount, setCartCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAdmin, isAuthenticated } = useAuth();

  // localStorage is read after mount only — reading it during render would make the
  // server and client markup disagree — and the same sync answers later cart updates.
  useEffect(() => {
    const sync = () => setCartCount(getCartCount());
    sync();
    window.addEventListener('cartUpdated', sync);
    return () => window.removeEventListener('cartUpdated', sync);
  }, []);

  // Fetch pending cart items count for authenticated users
  useEffect(() => {
    const fetchPendingCount = async () => {
      if (!isAuthenticated) {
        setPendingCount(0);
        return;
      }

      const token = localStorage.getItem('auth_token');
      if (!token) {
        setPendingCount(0);
        return;
      }

      try {
        const response = await api.authGet<Array<{ id: string }>>('/cart/pending');
        setPendingCount(response.length);
      } catch {
        setPendingCount(0);
      }
    };

    fetchPendingCount();

    // Listen for pending cart updates (e.g., when an offer is accepted)
    const handlePendingCartUpdate = () => {
      fetchPendingCount();
    };

    window.addEventListener('pendingCartUpdated', handlePendingCartUpdate);

    return () => {
      window.removeEventListener('pendingCartUpdated', handlePendingCartUpdate);
    };
  }, [isAuthenticated]);

  // The sheet is modal, so Radix locks body scroll and aria-hides the page behind it.
  // A sheet left open across the md breakpoint (an iPad rotating from portrait to
  // landscape) would keep both on a desktop layout that no longer shows it.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const desktop = window.matchMedia('(min-width: 768px)');
    const closeOnDesktop = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileMenuOpen(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, [mobileMenuOpen]);

  // Every link in the sheet closes it, so navigation never leaves it hanging open.
  const closeMobileMenu = () => setMobileMenuOpen(false);

  const totalCartCount = cartCount + pendingCount;
  const cartLabel = `Cart, ${totalCartCount} items`;
  const cartDisplay = totalCartCount > 99 ? '99+' : totalCartCount;
  const mobileCartBase =
    'flex h-12 w-12 flex-col items-center justify-center border-[1.5px] transition-colors cursor-pointer';

  return (
    <>
      {isAdmin && (
        <div className="label-mono bg-primary py-2 text-center text-primary-foreground">
          Signed in as admin
        </div>
      )}
      {/* The crimson rule is 2px on phones (the tab strip clears `--header-h` + 2px) and
          stays the 1px it has always been from md up. */}
      <header className="sticky top-0 z-50 border-b-2 border-primary bg-background/95 backdrop-blur-sm md:border-b">
        {/* Mobile: one row, a fixed 56px, so it cannot wrap whatever is inside it. */}
        <div className="grid h-14 grid-cols-[auto_1fr_auto] items-center px-5 md:hidden">
          <Link
            href="/"
            aria-label="Luke's Guitar Shop — home"
            className={cn('flex h-14 items-center cursor-pointer', focusRing)}
          >
            <MobileLogo />
          </Link>
          <div />
          <div className="flex items-center gap-2">
            <Link
              href="/cart"
              aria-label={cartLabel}
              className={cn(
                mobileCartBase,
                focusRing,
                totalCartCount > 0
                  ? 'border-primary bg-primary/8 text-primary'
                  : 'border-foreground text-foreground'
              )}
            >
              <ShoppingCart className="h-[19px] w-[19px]" />
              <span className="mt-0.5 font-mono text-[11px] leading-none tracking-[0.06em]">
                {cartDisplay}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              className={cn(
                'flex h-12 w-12 items-center justify-center bg-foreground text-background transition-colors hover:bg-primary cursor-pointer',
                focusRing
              )}
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Desktop: unchanged */}
        <div className="mx-auto hidden max-w-[1320px] flex-wrap items-center gap-5 px-5 py-2.5 md:flex">
          <Link href="/" className="mr-auto block leading-none cursor-pointer">
            <Image
              src="/images/logo-transparent.png"
              alt="Luke's Guitar Shop — Ohio"
              width={256}
              height={256}
              priority
              className="block h-[clamp(56px,9vw,128px)] w-auto object-contain"
            />
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden items-center gap-[27px] md:flex">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`font-nav transition-colors hover:text-primary cursor-pointer ${
                  link.primary ? 'text-foreground' : 'text-foreground/60'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {!isAdmin && (
            <Link
              href="/trade-in"
              className="btn-mono hidden min-h-[55px] border border-foreground/35 px-[19px] py-[11px] text-[13.5px] whitespace-nowrap text-foreground hover:border-primary hover:text-primary md:inline-flex cursor-pointer"
            >
              Trade-in →
            </Link>
          )}

          {isAdmin ? (
            <Link
              href="/admin"
              className="btn-mono hidden min-h-[55px] items-center gap-[11px] bg-foreground px-[18px] py-[11px] text-[13.5px] text-background hover:bg-primary md:inline-flex cursor-pointer"
            >
              <Shield className="h-5 w-5" />
              Admin
            </Link>
          ) : (
            <Link
              href="/cart"
              aria-label={`Cart, ${totalCartCount} items`}
              className="hidden min-h-[55px] min-w-[55px] items-center justify-center gap-[11px] bg-foreground px-[18px] py-[11px] text-background transition-colors hover:bg-primary md:inline-flex cursor-pointer"
            >
              <ShoppingCart className="h-6 w-6" />
              <span className="font-mono text-[13.5px] tracking-[0.1em]">
                {totalCartCount > 99 ? '99+' : totalCartCount}
              </span>
            </Link>
          )}

          {/* A nav element, not a div: the profile menu is navigation, and the e2e
              auth fixture identifies the signed-in state by `nav button:has(svg)`. */}
          <nav className="hidden md:block">
            <ProfileButton />
          </nav>
        </div>
      </header>

      {/* Mobile menu sheet. A Radix dialog rather than a hand-rolled overlay so focus is
          trapped while it is open and handed back to the hamburger when it closes. */}
      <DialogPrimitive.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-foreground/50 md:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-0 z-[60] flex flex-col bg-background md:hidden"
          >
            <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>

            {/* The sheet's own 56px bar mirrors the header so the page does not appear
                to jump when it opens. */}
            <div className="grid h-14 shrink-0 grid-cols-[auto_1fr_auto] items-center border-b-2 border-primary px-5">
              <Link
                href="/"
                onClick={closeMobileMenu}
                aria-label="Luke's Guitar Shop — home"
                className={cn('flex h-14 items-center cursor-pointer', focusRing)}
              >
                <MobileLogo />
              </Link>
              <div />
              <div className="flex items-center gap-2">
                <Link
                  href="/cart"
                  onClick={closeMobileMenu}
                  aria-label={cartLabel}
                  className={cn(mobileCartBase, focusRing, 'border-foreground/30 text-foreground')}
                >
                  <ShoppingCart className="h-[19px] w-[19px]" />
                  <span className="mt-0.5 font-mono text-[11px] leading-none tracking-[0.06em]">
                    {cartDisplay}
                  </span>
                </Link>
                <DialogPrimitive.Close
                  aria-label="Close menu"
                  className={cn(
                    'flex h-12 w-12 items-center justify-center bg-primary text-primary-foreground transition-colors hover:bg-foreground cursor-pointer',
                    focusRing
                  )}
                >
                  <X className="h-6 w-6" />
                </DialogPrimitive.Close>
              </div>
            </div>

            <nav
              id="mobile-menu"
              className="flex-1 overflow-y-auto border-t border-foreground/10 pb-5"
            >
              {menuGroups.map((group, groupIndex) => (
                <div key={group.label}>
                  <div
                    className={cn(
                      'label-mono px-5 pb-2 text-primary',
                      groupIndex === 0 ? 'pt-5' : 'pt-6'
                    )}
                  >
                    {group.label}
                  </div>
                  {group.items.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeMobileMenu}
                      className={cn(
                        'flex items-center justify-between border-t border-foreground/10 px-5 text-foreground transition-colors hover:text-primary cursor-pointer',
                        group.rowClass,
                        rowFocusRing
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ))}

              {!isAdmin && (
                <div className="px-5 pt-6 pb-5">
                  <Link
                    href="/trade-in"
                    onClick={closeMobileMenu}
                    className={cn(
                      'font-btn flex h-13 items-center justify-center bg-primary text-[13px] text-primary-foreground transition-colors hover:bg-foreground cursor-pointer',
                      focusRing
                    )}
                  >
                    Send me a trade-in
                  </Link>
                  <p className="mt-2.5 text-center text-[13px] leading-[1.45] text-foreground/60">
                    Cash or credit toward anything in stock.
                  </p>
                </div>
              )}

              <div className="border-t border-foreground/12 bg-muted-foreground/18">
                <MobileProfileButton onNavigate={closeMobileMenu} />
              </div>
            </nav>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
