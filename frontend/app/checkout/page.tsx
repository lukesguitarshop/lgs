'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ShoppingCart, ArrowLeft, Loader2 } from 'lucide-react';

interface CartItem {
  id: string;
  title: string;
  price: number;
  currency: string;
  image: string;
}

interface CheckoutResponse {
  sessionUrl: string;
  sessionId: string;
}

function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export default function CheckoutPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cart = localStorage.getItem('cart');
    if (cart) {
      setCartItems(JSON.parse(cart));
    }
    setLoading(false);
  }, []);

  const total = cartItems.reduce((sum, item) => sum + item.price, 0);
  const currency = cartItems[0]?.currency || 'USD';

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;

    setCheckoutLoading(true);
    setError(null);

    try {
      const response = await api.post<CheckoutResponse>('/checkout', {
        items: cartItems.map((item) => ({
          listingId: item.id,
          quantity: 1,
        })),
      });

      // Redirect to Stripe checkout
      window.location.href = response.sessionUrl;
    } catch (err) {
      setError('Failed to create checkout session. Please try again.');
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 px-4">
        <ShoppingCart className="w-24 h-24 mx-auto text-gray-300 mb-6" />
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Your cart is empty</h1>
        <p className="text-gray-600 mb-8">Add some items to your cart to proceed with checkout.</p>
        <Link
          href="/"
          className="inline-block bg-[#df5e15] hover:bg-[#c74d12] text-white font-semibold px-8 py-4 rounded-lg transition-all"
        >
          Browse Listings
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/cart"
        className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Cart
      </Link>

      <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items Summary */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
          {cartItems.map((item) => (
            <div
              key={item.id}
              className="flex gap-4 p-4 bg-white rounded-lg border border-gray-200"
            >
              <div className="relative w-20 h-20 flex-shrink-0 rounded overflow-hidden bg-gray-100">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">
                    🎸
                  </div>
                )}
              </div>
              <div className="flex-grow min-w-0">
                <h3 className="font-medium text-gray-900 truncate">{item.title}</h3>
                <p className="text-lg font-semibold text-gray-900 mt-1">
                  {formatPrice(item.price, item.currency)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Payment Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Summary</h2>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal ({cartItems.length} item{cartItems.length !== 1 ? 's' : ''})</span>
                <span>{formatPrice(total, currency)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span className="text-green-600">Free</span>
              </div>
              <div className="border-t pt-3 flex justify-between font-semibold text-lg text-gray-900">
                <span>Total</span>
                <span>{formatPrice(total, currency)}</span>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <Button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="w-full bg-[#df5e15] hover:bg-[#c54d0a] text-white font-semibold py-6 text-lg"
            >
              {checkoutLoading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Pay with Stripe'
              )}
            </Button>

            <p className="text-xs text-gray-500 text-center mt-4">
              Secure payment powered by Stripe
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
