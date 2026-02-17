'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, Menu, X, Shield, User } from 'lucide-react';
import { getCartCount } from '@/lib/cart';
import { ProfileButton, MobileProfileButton } from '@/components/auth/ProfileButton';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

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

  return (
    <>
      {isAdmin && (
        <div className="bg-[#df5e15] text-white text-center py-2 text-sm font-medium">
          Signed in as admin
        </div>
      )}
      <header className="bg-card text-card-foreground shadow-md border-b border-border">
        <div className="container mx-auto px-4 py-0">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center cursor-pointer">
              <Image
                src="/images/logo-transparent.png"
                alt="Luke's Guitar Shop Logo"
                width={150}
                height={150}
                className="object-contain"
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-4">
              <Link
                href="/"
                className="px-4 py-2 rounded-lg bg-[#df5e15] text-white hover:bg-[#c74d12] transition-colors cursor-pointer"
              >
                Listings
              </Link>
              <Link
                href="/shop-info"
                className="px-4 py-2 rounded-lg bg-[#df5e15] text-white hover:bg-[#c74d12] transition-colors cursor-pointer"
              >
                Shop Info
              </Link>
              <Link
                href="/cart"
                className="relative px-4 py-2 rounded-lg bg-[#df5e15] text-white hover:bg-[#c74d12] transition-colors flex items-center cursor-pointer"
              >
                <ShoppingCart className="h-5 w-5" />
                {(cartCount + pendingCount) > 0 && (
                  <span className={`absolute -top-2 -right-2 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center ${pendingCount > 0 ? 'bg-amber-500' : 'bg-red-500'}`}>
                    {(cartCount + pendingCount) > 99 ? '99+' : cartCount + pendingCount}
                  </span>
                )}
              </Link>
              <ProfileButton />
            </nav>

            {/* Mobile: Admin button (if admin) + Cart (if not admin) + Menu button */}
            <div className="flex md:hidden items-center space-x-2">
              {isAdmin && (
                <Link
                  href="/admin"
                  className="p-2 rounded-lg bg-[#df5e15] text-white hover:bg-[#c74d12] transition-colors cursor-pointer"
                  aria-label="Admin Portal"
                >
                  <Shield className="h-5 w-5" />
                </Link>
              )}
              {!isAdmin && (
                <Link
                  href="/cart"
                  onClick={closeMobileMenu}
                  className="relative p-2 rounded-lg bg-[#df5e15] text-white hover:bg-[#c74d12] transition-colors cursor-pointer"
                >
                  <ShoppingCart className="h-5 w-5" />
                  {(cartCount + pendingCount) > 0 && (
                    <span className={`absolute -top-2 -right-2 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center ${pendingCount > 0 ? 'bg-amber-500' : 'bg-red-500'}`}>
                      {(cartCount + pendingCount) > 99 ? '99+' : cartCount + pendingCount}
                    </span>
                  )}
                </Link>
              )}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg bg-[#df5e15] text-white hover:bg-[#c74d12] transition-colors cursor-pointer"
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : (isAdmin ? <Menu className="h-6 w-6" /> : <User className="h-5 w-5" />)}
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* Mobile Menu Full-Page Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-white">
          {/* Overlay Header with Close Button */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-white">
            <span className="text-lg font-semibold">Menu</span>
            <button
              onClick={closeMobileMenu}
              className="p-2 rounded-lg bg-[#df5e15] text-white hover:bg-[#c74d12] transition-colors cursor-pointer"
              aria-label="Close menu"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Menu Content */}
          <nav className="p-4 overflow-y-auto bg-white" style={{ height: 'calc(100vh - 73px)' }}>
            <div className="flex flex-col space-y-2">
              <Link
                href="/"
                onClick={closeMobileMenu}
                className="px-4 py-3 rounded-lg bg-[#df5e15] text-white hover:bg-[#c74d12] transition-colors text-center cursor-pointer"
              >
                Home
              </Link>
              <Link
                href="/shop-info"
                onClick={closeMobileMenu}
                className="px-4 py-3 rounded-lg bg-[#df5e15] text-white hover:bg-[#c74d12] transition-colors text-center cursor-pointer"
              >
                Shop Info
              </Link>
              <MobileProfileButton onNavigate={closeMobileMenu} />
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
