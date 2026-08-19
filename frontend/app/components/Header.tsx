'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, Menu, X, Shield, User } from 'lucide-react';
import { getCartCount } from '@/lib/cart';
import { ProfileButton, MobileProfileButton } from '@/components/auth/ProfileButton';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

/** Homepage sections are anchors; everything else is a real route. */
const navLinks = [
  { href: '/#inventory', label: 'Listings', primary: true },
  { href: '/sold', label: 'Sold', primary: false },
  { href: '/#about', label: 'About', primary: false },
  { href: '/shop-info', label: 'Shop info', primary: false },
];

export default function Header() {
  const [cartCount, setCartCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAdmin, isAuthenticated } = useAuth();

  useEffect(() => {
    // Initialize cart count
    setCartCount(getCartCount());

    // Listen for cart updates
    const handleCartUpdate = () => {
      setCartCount(getCartCount());
    };

    window.addEventListener('cartUpdated', handleCartUpdate);

    return () => {
      window.removeEventListener('cartUpdated', handleCartUpdate);
    };
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

  // Close mobile menu when route changes
  const closeMobileMenu = () => setMobileMenuOpen(false);

  const totalCartCount = cartCount + pendingCount;
  const mobileLinkClass =
    'font-nav bg-primary px-4 py-3 text-center text-primary-foreground transition-colors hover:bg-foreground cursor-pointer';

  return (
    <>
      {isAdmin && (
        <div className="label-mono bg-primary py-2 text-center text-primary-foreground">
          Signed in as admin
        </div>
      )}
      <header className="sticky top-0 z-50 border-b border-primary bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-5 px-5 py-2.5">
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

          <div className="hidden md:block">
            <ProfileButton />
          </div>

          {/* Mobile: admin shortcut or cart, then the menu toggle */}
          <div className="flex items-center gap-2 md:hidden">
            {isAdmin ? (
              <Link
                href="/admin"
                className="flex min-h-[48px] min-w-[48px] items-center justify-center bg-primary text-primary-foreground transition-colors hover:bg-foreground cursor-pointer"
                aria-label="Admin Portal"
              >
                <Shield className="h-5 w-5" />
              </Link>
            ) : (
              <Link
                href="/cart"
                onClick={closeMobileMenu}
                aria-label={`Cart, ${totalCartCount} items`}
                className="flex min-h-[48px] items-center justify-center gap-2 bg-foreground px-3 text-background transition-colors hover:bg-primary cursor-pointer"
              >
                <ShoppingCart className="h-5 w-5" />
                <span className="font-mono text-xs tracking-[0.1em]">
                  {totalCartCount > 99 ? '99+' : totalCartCount}
                </span>
              </Link>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex min-h-[48px] min-w-[48px] items-center justify-center bg-primary text-primary-foreground transition-colors hover:bg-foreground cursor-pointer"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : isAdmin ? <Menu className="h-6 w-6" /> : <User className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Full-Page Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-background md:hidden">
          <div className="flex items-center justify-between border-b border-primary bg-background p-4">
            <span className="font-heading text-xl">Menu</span>
            <button
              onClick={closeMobileMenu}
              className="flex min-h-[48px] min-w-[48px] items-center justify-center bg-primary text-primary-foreground transition-colors hover:bg-foreground cursor-pointer"
              aria-label="Close menu"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="overflow-y-auto bg-background p-4" style={{ height: 'calc(100vh - 81px)' }}>
            <div className="flex flex-col gap-2">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMobileMenu}
                  className={mobileLinkClass}
                >
                  {link.label}
                </Link>
              ))}
              {!isAdmin && (
                <Link href="/trade-in" onClick={closeMobileMenu} className={mobileLinkClass}>
                  Trade-in
                </Link>
              )}
              <MobileProfileButton onNavigate={closeMobileMenu} />
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
