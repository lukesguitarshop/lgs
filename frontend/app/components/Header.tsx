'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ShoppingCart, Menu, X, Shield, Search, ArrowRight } from 'lucide-react';
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
/** The sheet's headline group: where people actually go, with the size to match. */
const shopLinks = [
  { href: '/#inventory', label: 'Listings', count: 'listings' as const },
  { href: '/sold', label: 'Sold', count: 'sold' as const },
  { href: '/favorites', label: 'Favourites', count: 'favourites' as const },
];

/** The trust pages, paired off into tiles so four of them cost four rows, not eight. */
const infoLinks = [
  { href: '/#about', label: 'About Luke' },
  { href: '/shop-info?tab=return-policy', label: 'Shipping & returns' },
  { href: '/shop-info?tab=reviews', label: 'Reviews' },
  { href: '/contact', label: 'Contact' },
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

interface MenuCounts {
  listings: number | null;
  sold: number | null;
  favourites: number | null;
}

export default function Header() {
  const router = useRouter();
  const [menuQuery, setMenuQuery] = useState('');
  const [menuCounts, setMenuCounts] = useState<MenuCounts>({
    listings: null,
    sold: null,
    favourites: null,
  });
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

  // The counts beside the sheet's shop links are worth a request only once someone has
  // actually opened the sheet — they are decoration on a menu, not live figures. Each
  // settles on its own; a missing one just renders no count. Deliberately keyed on the
  // sheet and the viewer only: keying it on the counts too would let each result that
  // landed re-run the effect and cancel the requests still in flight.
  useEffect(() => {
    if (!mobileMenuOpen) return;

    let cancelled = false;
    const set = (key: keyof MenuCounts, value: number) =>
      setMenuCounts(prev => (cancelled ? prev : { ...prev, [key]: value }));

    api
      .get<unknown[]>('/listings')
      .then(rows => set('listings', rows.length))
      .catch(() => {});
    api
      .get<unknown[]>('/listings/sold')
      .then(rows => set('sold', rows.length))
      .catch(() => {});
    if (isAuthenticated) {
      api
        .authGet<unknown[]>('/favorites')
        .then(rows => set('favourites', rows.length))
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [mobileMenuOpen, isAuthenticated]);

  // Every link in the sheet closes it, so navigation never leaves it hanging open.
  const closeMobileMenu = () => setMobileMenuOpen(false);

  // Search from the sheet hands the term to the home page's own filter state, which
  // reads it straight back out of the query string, and jumps to the grid.
  const submitMenuSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const q = menuQuery.trim();
    router.push(q ? `/?q=${encodeURIComponent(q)}#inventory` : '/#inventory');
    setMenuQuery('');
    closeMobileMenu();
  };

  const totalCartCount = cartCount + pendingCount;
  const cartLabel = `Cart, ${totalCartCount} items`;
  const cartDisplay = totalCartCount > 99 ? '99+' : totalCartCount;
  const mobileCartBase =
    'flex h-12 w-12 flex-col items-center justify-center border-[1.5px] transition-colors cursor-pointer';

  /**
   * Admins never shop, so the phone bar spends that slot the way the desktop bar does:
   * the cart becomes the way into the portal. Bordered rather than solid, because the
   * hamburger beside it is already a filled block.
   */
  const mobileAdminLink = () => (
    <Link
      href="/admin"
      aria-label="Admin portal"
      className={cn(mobileCartBase, focusRing, 'border-primary bg-primary/8 text-primary')}
    >
      <Shield className="h-[19px] w-[19px]" />
      <span className="mt-0.5 font-mono text-[9px] leading-none tracking-[0.08em]">ADMIN</span>
    </Link>
  );

  /**
   * The same control in the page bar and in the sheet's bar: opening the menu must not
   * reshape the cart under the thumb, so there is one definition of it, not two.
   */
  const mobileCartLink = (onClick?: () => void) => (
    <Link
      href="/cart"
      onClick={onClick}
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
  );

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
        {/* Mobile: one row, a fixed 84px, so it cannot wrap whatever is inside it. */}
        <div className="grid h-21 grid-cols-[auto_1fr_auto] items-center px-5 md:hidden">
          <Link
            href="/"
            aria-label="Luke's Guitar Shop — home"
            className={cn('flex h-21 items-center cursor-pointer', focusRing)}
          >
            <MobileLogo />
          </Link>
          <div />
          <div className="flex items-center gap-2">
            {isAdmin ? mobileAdminLink() : mobileCartLink()}
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
            <div className="grid h-21 shrink-0 grid-cols-[auto_1fr_auto] items-center border-b-2 border-primary px-5">
              <Link
                href="/"
                onClick={closeMobileMenu}
                aria-label="Luke's Guitar Shop — home"
                className={cn('flex h-21 items-center cursor-pointer', focusRing)}
              >
                <MobileLogo />
              </Link>
              <div />
              <div className="flex items-center gap-2">
                {/* No admin shortcut here: the owner's account block already ends the
                    sheet with the portal, and two of them in one sheet is one too many. */}
                {!isAdmin && mobileCartLink(closeMobileMenu)}
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

            <nav id="mobile-menu" className="flex flex-1 flex-col overflow-y-auto">
              <form onSubmit={submitMenuSearch} className="px-[18px] pt-4">
                <label htmlFor="menu-search" className="sr-only">
                  Search the shop
                </label>
                <div className="flex h-[46px] items-center gap-2.5 rounded-xl border border-foreground/10 bg-muted-foreground/18 px-3.5 focus-within:border-primary">
                  <Search className="h-4 w-4 shrink-0 text-foreground/45" />
                  <input
                    id="menu-search"
                    type="search"
                    value={menuQuery}
                    onChange={e => setMenuQuery(e.target.value)}
                    placeholder="Search guitars, pedals, amps"
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-foreground/45 focus:outline-none"
                  />
                </div>
              </form>

              <div className="px-[18px] pt-[22px]">
                <div className="label-mono pb-2.5 text-primary">Shop</div>
                {shopLinks.map(link => {
                  // A bare "0" beside a nav row reads as a failure, not as "none yet".
                  const count = menuCounts[link.count] || null;
                  const live = link.count === 'favourites' && !!count;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={closeMobileMenu}
                      className={cn(
                        'flex h-13 items-center justify-between text-foreground transition-colors hover:text-primary cursor-pointer',
                        rowFocusRing
                      )}
                    >
                      <span className="text-[26px] font-semibold tracking-[-0.02em]">
                        {link.label}
                      </span>
                      {count !== null && (
                        <span
                          className={cn(
                            'font-mono text-[11px]',
                            live ? 'font-bold text-primary' : 'text-foreground/50'
                          )}
                        >
                          {count}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>

              {!isAdmin && (
                <div className="px-[18px] pt-[18px]">
                  <Link
                    href="/trade-in"
                    onClick={closeMobileMenu}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-[14px] bg-primary p-[18px] text-primary-foreground transition-colors hover:bg-foreground cursor-pointer',
                      focusRing
                    )}
                  >
                    <span className="flex flex-col gap-[5px]">
                      <span className="text-[17px] font-bold tracking-[-0.01em]">
                        Send me a trade-in
                      </span>
                      <span className="text-[12.5px] text-primary-foreground/75">
                        Cash or credit toward anything in stock.
                      </span>
                    </span>
                    <ArrowRight className="h-5 w-5 shrink-0" />
                  </Link>
                </div>
              )}

              <div className="px-[18px] pt-[22px] pb-5">
                <div className="label-mono pb-2.5 text-primary">Shop info</div>
                <div className="grid grid-cols-2 gap-2">
                  {infoLinks.map(link => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={closeMobileMenu}
                      className={cn(
                        'flex h-[46px] items-center rounded-[10px] border border-foreground/12 px-[13px] text-[14.5px] text-foreground transition-colors hover:border-primary hover:text-primary cursor-pointer',
                        focusRing
                      )}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Pushed to the foot, so a short sheet never trails off into empty cream. */}
              <div className="mt-auto">
                <MobileProfileButton onNavigate={closeMobileMenu} />
              </div>
            </nav>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
