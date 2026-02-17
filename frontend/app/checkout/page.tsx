'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ShoppingCart, ArrowLeft, Loader2, CreditCard, LogIn, MapPin, Plus, Pencil } from 'lucide-react';
import PayPalCheckoutButton from '@/components/PayPalCheckoutButton';
import ShippingAddressModal from '@/components/checkout/ShippingAddressModal';
import { useAuth } from '@/contexts/AuthContext';
import { ShippingAddress } from '@/lib/auth';

type PaymentMethod = 'stripe' | 'paypal';

interface CartItem {
  id: string;
  title: string;
  price: number;
  currency: string;
  image: string;
  isLocked?: boolean;
}

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
  const router = useRouter();
  const { user, isAuthenticated, setShowLoginModal, setShowRegisterModal } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('stripe');
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [savedAddress, setSavedAddress] = useState<ShippingAddress | null>(null);

  // Load cart from localStorage and fetch pending items
  useEffect(() => {
    const loadCart = async () => {
      // Get local cart items
      const cart = localStorage.getItem('cart');
      const localItems: CartItem[] = cart ? JSON.parse(cart) : [];

      // Fetch pending cart items if authenticated
      let pendingItems: CartItem[] = [];
      if (isAuthenticated) {
        const token = localStorage.getItem('auth_token');
        if (token) {
          try {
            const response = await api.authGet<PendingCartItemResponse[]>('/cart/pending');
            pendingItems = response.map((item) => ({
              id: item.listingId,
              title: item.title,
              price: item.price,
              currency: item.currency,
              image: item.image,
              isLocked: true,
            }));
          } catch {
            // Silently fail - pending items are optional
          }
        }
      }

      // Merge: pending items first, then local items (excluding duplicates)
      const mergedItems = [
        ...pendingItems,
        ...localItems.filter(
          (localItem) => !pendingItems.some((pendingItem) => pendingItem.id === localItem.id)
        ),
      ];

      setCartItems(mergedItems);
      setLoading(false);
    };

    loadCart();
  }, [isAuthenticated]);

  // Load saved address from user profile
  useEffect(() => {
    if (isAuthenticated && user?.shippingAddress) {
      setSavedAddress({
        fullName: user.shippingAddress.fullName || user.fullName || '',
        line1: user.shippingAddress.line1 || '',
        line2: user.shippingAddress.line2 || '',
        city: user.shippingAddress.city || '',
        state: user.shippingAddress.state || '',
        postalCode: user.shippingAddress.postalCode || '',
        country: user.shippingAddress.country || '',
      });
    }
  }, [isAuthenticated, user]);

  const total = cartItems.reduce((sum, item) => sum + item.price, 0);
  const currency = cartItems[0]?.currency || 'USD';

  const hasValidAddress = savedAddress &&
    savedAddress.fullName &&
    savedAddress.line1 &&
    savedAddress.city &&
    savedAddress.state &&
    savedAddress.postalCode &&
    savedAddress.country;

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    if (!hasValidAddress || !savedAddress) {
      setError('Please add a shipping address first');
      return;
    }

    setCheckoutLoading(true);
    setError(null);

    try {
      // Build checkout request data
      const checkoutData = {
        items: cartItems.map((item) => ({
          listingId: item.id,
          quantity: 1,
        })),
        shippingAddress: savedAddress,
      };

      // Use authenticated request (authentication is required)
      const response = await api.authPost<CheckoutResponse>('/checkout', checkoutData);

      // Redirect to Stripe checkout
      window.location.href = response.sessionUrl;
    } catch (err) {
      setError('Failed to create checkout session. Please try again.');
      setCheckoutLoading(false);
    }
  };

  const handleAddressSave = (address: ShippingAddress) => {
    setSavedAddress(address);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Require authentication to checkout
  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 px-4">
        <LogIn className="w-24 h-24 mx-auto text-gray-300 mb-6" />
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Sign In Required</h1>
        <p className="text-gray-600 mb-8">
          Please sign in or create an account to proceed with checkout.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={() => setShowLoginModal(true)}
            className="bg-[#df5e15] hover:bg-[#c74d12] text-white font-semibold px-8 py-4"
          >
            Sign In
          </Button>
          <Button
            onClick={() => setShowRegisterModal(true)}
            variant="outline"
            className="font-semibold px-8 py-4"
          >
            Create Account
          </Button>
        </div>
        <Link
          href="/cart"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mt-8 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Cart
        </Link>
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
          className="inline-block bg-[#df5e15] hover:bg-[#c74d12] text-white font-semibold px-8 py-4 rounded-lg transition-all cursor-pointer"
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
        className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Cart
      </Link>

      <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Shipping Address & Order Summary */}
        <div className="lg:col-span-2 space-y-8">
          {/* Shipping Address Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Shipping Address</h2>

            {hasValidAddress && savedAddress ? (
              // Show saved address card
              <div
                className="p-4 border border-gray-200 rounded-lg hover:border-[#df5e15] hover:bg-orange-50 cursor-pointer transition-all group"
                onClick={() => setAddressModalOpen(true)}
              >
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{savedAddress.fullName}</p>
                    <p className="text-gray-600 text-sm">{savedAddress.line1}</p>
                    {savedAddress.line2 && (
                      <p className="text-gray-600 text-sm">{savedAddress.line2}</p>
                    )}
                    <p className="text-gray-600 text-sm">
                      {savedAddress.city}, {savedAddress.state} {savedAddress.postalCode}
                    </p>
                    <p className="text-gray-600 text-sm">{savedAddress.country}</p>
                  </div>
                  <button
                    className="p-2 text-gray-400 hover:text-[#df5e15] group-hover:text-[#df5e15] transition-colors cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAddressModalOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              // Show add address button
              <button
                onClick={() => setAddressModalOpen(true)}
                className="w-full p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#df5e15] hover:bg-orange-50 transition-all flex flex-col items-center gap-2 text-gray-500 hover:text-[#df5e15] cursor-pointer"
              >
                <Plus className="h-8 w-8" />
                <span className="font-medium">Add Shipping Address</span>
                <span className="text-sm">Required to continue with checkout</span>
              </button>
            )}
          </div>

          {/* Order Summary */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Order Summary</h2>
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

            {/* Payment Method Selection */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Payment Method</h3>
              <div className="space-y-2">
                <label
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${
                    paymentMethod === 'stripe'
                      ? 'border-[#df5e15] bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="stripe"
                    checked={paymentMethod === 'stripe'}
                    onChange={() => setPaymentMethod('stripe')}
                    className="sr-only"
                  />
                  <CreditCard className="h-5 w-5 text-gray-600 mr-3" />
                  <span className="flex-1 font-medium text-gray-900">Credit Card</span>
                  <span className="text-xs text-gray-500">Powered by Stripe</span>
                </label>
                <label
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${
                    paymentMethod === 'paypal'
                      ? 'border-[#df5e15] bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="paypal"
                    checked={paymentMethod === 'paypal'}
                    onChange={() => setPaymentMethod('paypal')}
                    className="sr-only"
                  />
                  <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24" fill="none">
                    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.217a.774.774 0 0 1 .763-.645h6.678c2.213 0 3.987.686 5.277 2.04 1.29 1.355 1.772 3.17 1.433 5.396-.34 2.227-1.404 4.042-3.164 5.393-1.76 1.352-3.91 2.029-6.39 2.029H7.35l-1.274 3.907a.641.641 0 0 1-.001 0z" fill="#003087"/>
                    <path d="M19.152 8.392c-.34 2.227-1.404 4.042-3.164 5.393-1.76 1.352-3.91 2.029-6.39 2.029H7.35l-1.274 3.907a.641.641 0 0 1-.612.456H2.47a.641.641 0 0 1-.633-.74l.35-2.15a.774.774 0 0 1 .763-.645h2.394a.774.774 0 0 0 .763-.645l.937-5.933a.774.774 0 0 1 .763-.645h2.215c2.48 0 4.63-.677 6.39-2.03 1.76-1.35 2.824-3.165 3.164-5.392.339-2.226-.144-4.04-1.434-5.396C16.852 5.201 15.078 4.515 12.865 4.515H6.187a.774.774 0 0 0-.763.645L2.318 22.537a.641.641 0 0 0 .633.74h4.607a.641.641 0 0 0 .612-.457l1.274-3.907h2.191c2.48 0 4.63-.677 6.39-2.029 1.76-1.351 2.824-3.166 3.164-5.393.338-2.226-.144-4.041-1.434-5.396 1.053 1.107 1.467 2.59 1.396 4.297z" fill="#0070E0"/>
                  </svg>
                  <span className="flex-1 font-medium text-gray-900">PayPal</span>
                </label>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {!hasValidAddress && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                Please add a shipping address to continue
              </div>
            )}

            {paymentMethod === 'stripe' ? (
              <>
                <Button
                  onClick={handleCheckout}
                  disabled={checkoutLoading || !hasValidAddress}
                  className="w-full bg-[#df5e15] hover:bg-[#c54d0a] text-white font-semibold py-6 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
              </>
            ) : (
              <div>
                <PayPalCheckoutButton
                  cartItems={cartItems}
                  shippingAddress={savedAddress || {
                    fullName: '',
                    line1: '',
                    line2: '',
                    city: '',
                    state: '',
                    postalCode: '',
                    country: '',
                  }}
                  total={total}
                  currency={currency}
                  disabled={!hasValidAddress}
                  useAuth={true}
                  onSuccess={async (orderId) => {
                    localStorage.removeItem('cart');
                    router.push(`/checkout/success?paypal_order_id=${orderId}`);
                  }}
                  onError={(errorMsg) => setError(errorMsg)}
                />
                <p className="text-xs text-gray-500 text-center mt-4">
                  Secure payment powered by PayPal
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Shipping Address Modal */}
      <ShippingAddressModal
        isOpen={addressModalOpen}
        onClose={() => setAddressModalOpen(false)}
        initialAddress={savedAddress}
        onSave={handleAddressSave}
      />
    </div>
  );
}
