'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Trash2, ArrowLeft, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { CartItem, getCart, removeFromCart } from '@/lib/cart';
import { trackRemoveFromCart } from '@/lib/analytics';

interface PendingCartItemResponse {
  id: string;
  listingId: string;
  offerId: string;
  title: string;
  image: string;
  price: number;
  currency: string;
  isLocked: boolean;
  createdAt: string;
  expiresAt: string;
}

function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export default function CartPage() {
  const [localCartItems, setLocalCartItems] = useState<CartItem[]>([]);
  const [pendingItems, setPendingItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPending, setLoadingPending] = useState(false);
  const { isAuthenticated } = useAuth();

  // Load local cart items
  useEffect(() => {
    const items = getCart();
    setLocalCartItems(items);
    setLoading(false);
  }, []);

  // Fetch pending cart items from API if authenticated
  useEffect(() => {
    const fetchPendingItems = async () => {
      if (!isAuthenticated) {
        setPendingItems([]);
        return;
      }

      // Check if we have a valid token before making the request
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setPendingItems([]);
        return;
      }

      setLoadingPending(true);
      try {
        const response = await api.authGet<PendingCartItemResponse[]>('/cart/pending');
        // Transform pending items to CartItem format with isLocked flag
        const transformedItems: CartItem[] = response.map((item) => ({
          id: item.listingId,
          title: item.title,
          price: item.price,
          currency: item.currency,
          image: item.image,
          isLocked: true,
          offerId: item.offerId,
        }));
        setPendingItems(transformedItems);
      } catch (error: unknown) {
        // Silently fail - pending items are optional, cart still works without them
        const apiError = error as { status?: number; message?: string };
        if (apiError.status === 401) {
          // Token expired or invalid - not a real error
          console.debug('Auth token invalid, skipping pending items');
        } else {
          console.warn('Could not fetch pending cart items:', apiError.message || error);
        }
        setPendingItems([]);
      } finally {
        setLoadingPending(false);
      }
    };

    fetchPendingItems();
  }, [isAuthenticated]);

  // Merge local cart items with pending items (pending items first)
  const cartItems = [...pendingItems, ...localCartItems.filter(
    (localItem) => !pendingItems.some((pendingItem) => pendingItem.id === localItem.id)
  )];

  const removeItem = (itemId: string) => {
    const item = cartItems.find((i) => i.id === itemId);
    // Use removeFromCart which handles locked items
    const removed = removeFromCart(itemId);
    if (removed) {
      if (item) {
        trackRemoveFromCart({ id: item.id, name: item.title, price: item.price });
      }
      setLocalCartItems(localCartItems.filter((item) => item.id !== itemId));
    }
  };

  const hasLockedItems = pendingItems.length > 0;

  const total = cartItems.reduce((sum, item) => sum + item.price, 0);
  const currency = cartItems[0]?.currency || 'USD';

  if (loading || loadingPending) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-pulse text-gray-400">Loading cart...</div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 px-4">
        <ShoppingCart className="w-24 h-24 mx-auto text-gray-300 mb-6" />
        <h1 className="text-2xl font-bold text-[#020E1C] mb-4">Your cart is empty</h1>
        <p className="text-gray-600 mb-8">
          Looks like you haven&apos;t added anything to your cart yet.
        </p>
        <Link
          href="/"
          className="inline-block bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3] font-semibold px-8 py-4 rounded-lg transition-all cursor-pointer"
        >
          Browse Listings
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center text-gray-600 hover:text-[#020E1C] mb-6 transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Continue Shopping
      </Link>

      <h1 className="text-3xl font-bold text-[#020E1C] mb-8">Shopping Cart</h1>

      {hasLockedItems && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-700 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-900 font-medium">Reserved Items</p>
            <p className="text-red-800 text-sm">
              You have items reserved from accepted offers. These items are automatically added and cannot be removed.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {cartItems.map((item) => (
            <div
              key={item.id}
              className={`flex gap-4 p-4 bg-[#FFFFF3] rounded-lg border ${
                item.isLocked
                  ? 'border-red-300 ring-1 ring-red-200'
                  : 'border-gray-200'
              }`}
            >
              <Link
                href={`/listing/${item.id}`}
                className="relative w-24 h-24 flex-shrink-0 rounded overflow-hidden bg-gray-100 hover:opacity-80 transition-opacity cursor-pointer"
              >
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl">
                    🎸
                  </div>
                )}
              </Link>
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2">
                  <Link href={`/listing/${item.id}`} className="cursor-pointer">
                    <h3 className="font-medium text-[#020E1C] hover:text-[#6E0114] transition-colors line-clamp-2">
                      {item.title}
                    </h3>
                  </Link>
                  {item.isLocked && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                      <Lock className="h-3 w-3" />
                      Reserved
                    </span>
                  )}
                </div>
                <p className="text-lg font-semibold text-[#020E1C] mt-2">
                  {formatPrice(item.price, item.currency)}
                </p>
              </div>
              {item.isLocked ? (
                <div
                  className="flex-shrink-0 p-2 text-red-700 cursor-not-allowed"
                  title="This item is reserved from an accepted offer and cannot be removed"
                >
                  <Lock className="h-5 w-5" />
                </div>
              ) : (
                <button
                  onClick={() => removeItem(item.id)}
                  className="flex-shrink-0 p-2 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                  aria-label="Remove item"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-[#FFFFF3] rounded-lg border border-gray-200 p-6 sticky top-8">
            <h2 className="text-lg font-semibold text-[#020E1C] mb-4">Order Summary</h2>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal ({cartItems.length} item{cartItems.length !== 1 ? 's' : ''})</span>
                <span>{formatPrice(total, currency)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span className="text-green-600">Free</span>
              </div>
              <div className="border-t pt-3 flex justify-between font-semibold text-lg text-[#020E1C]">
                <span>Total</span>
                <span>{formatPrice(total, currency)}</span>
              </div>
            </div>

            <Link href="/checkout">
              <Button className="w-full bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3] font-semibold py-6 text-lg">
                Proceed to Checkout
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
