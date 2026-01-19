'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart } from 'lucide-react';
import { getCartCount } from '@/lib/cart';

export default function Header() {
  const [cartCount, setCartCount] = useState(0);

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

  return (
    <header className="bg-white text-gray-900 shadow-md border-b border-gray-200">
      <div className="container mx-auto px-4 py-0">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image
              src="/images/logo.png"
              alt="Luke's Guitar Shop Logo"
              width={150}
              height={150}
              className="object-contain"
            />
          </Link>
          <nav className="flex items-center space-x-4">
            <Link
              href="/"
              className="px-4 py-2 rounded-lg bg-[#df5e15] text-white hover:bg-[#c74d12] transition-colors"
            >
              Home
            </Link>
            <Link
              href="/about"
              className="px-4 py-2 rounded-lg bg-[#df5e15] text-white hover:bg-[#c74d12] transition-colors"
            >
              About
            </Link>
            <Link
              href="/cart"
              className="relative px-4 py-2 rounded-lg bg-[#df5e15] text-white hover:bg-[#c74d12] transition-colors flex items-center"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
