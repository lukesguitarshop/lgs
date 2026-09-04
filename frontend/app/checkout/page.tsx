'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getMyStoreCredit } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { StateBlock } from '@/components/ui/state-block';
import { StickyBar } from '@/components/ui/sticky-bar';
import { ShoppingCart, ArrowLeft, Loader2, CreditCard, LogIn, MapPin, Plus, Pencil, Check } from 'lucide-react';
import PayPalCheckoutButton from '@/components/PayPalCheckoutButton';
import ShippingAddressModal from '@/components/checkout/ShippingAddressModal';
import { useAuth } from '@/contexts/AuthContext';
import { ShippingAddress } from '@/lib/auth';
import { trackBeginCheckout } from '@/lib/analytics';
import { cn } from '@/lib/utils';

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

/** The phone summary rows print cents; the headline totals don't. */
function formatExact(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

const EMPTY_ADDRESS: ShippingAddress = {
  fullName: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
};

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; description: string }[] = [
  { value: 'stripe', label: 'Card', description: 'Visa, Mastercard, Amex — powered by Stripe' },
  { value: 'paypal', label: 'PayPal', description: 'Redirects to PayPal · 3.5% fee' },
];

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
  const [creditBalance, setCreditBalance] = useState(0);
  const [applyCredit, setApplyCredit] = useState(false);

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
    if (!isAuthenticated || !user?.shippingAddress) return;
    const sync = () =>
      setSavedAddress({
        fullName: user.shippingAddress?.fullName || user.fullName || '',
        line1: user.shippingAddress?.line1 || '',
        line2: user.shippingAddress?.line2 || '',
        city: user.shippingAddress?.city || '',
        state: user.shippingAddress?.state || '',
        postalCode: user.shippingAddress?.postalCode || '',
        country: user.shippingAddress?.country || '',
      });
    sync();
  }, [isAuthenticated, user]);

  // Load store credit balance
  useEffect(() => {
    if (!isAuthenticated) return;
    getMyStoreCredit().then(d => setCreditBalance(d.balance)).catch(() => {});
  }, [isAuthenticated]);

  const subtotal = cartItems.reduce((sum, item) => sum + item.price, 0);
  const creditApplied = applyCredit ? Math.min(creditBalance, subtotal) : 0;
  const subtotalAfterCredit = subtotal - creditApplied;
  const paypalFee = Math.round(subtotalAfterCredit * 0.035 * 100) / 100; // 3.5% fee on amount after store credit
  const total = paymentMethod === 'paypal' ? subtotal + paypalFee : subtotal;
  const totalAfterCredit = paymentMethod === 'paypal'
    ? subtotalAfterCredit + paypalFee
    : subtotalAfterCredit;
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
      setError('Please add a shipping address to continue');
      return;
    }

    setCheckoutLoading(true);
    setError(null);
    trackBeginCheckout(totalAfterCredit, currency);
    sessionStorage.setItem('checkout_total', JSON.stringify({ total: totalAfterCredit, currency }));

    try {
      // Build checkout request data
      const checkoutData = {
        items: cartItems.map((item) => ({
          listingId: item.id,
          quantity: 1,
        })),
        shippingAddress: savedAddress,
        applyStoreCredit: applyCredit,
      };

      // Use authenticated request (authentication is required)
      const response = await api.authPost<CheckoutResponse>('/checkout', checkoutData);

      // Redirect to Stripe checkout
      window.location.href = response.sessionUrl;
    } catch {
      setError('Failed to create checkout session. Please try again.');
      setCheckoutLoading(false);
    }
  };

  const handleAddressSave = (address: ShippingAddress) => {
    setSavedAddress(address);
  };

  const handlePayPalSuccess = async (orderId: string) => {
    localStorage.removeItem('cart');
    router.push(`/checkout/success?paypal_order_id=${orderId}`);
  };

  const handlePayPalError = (errorMsg: string) => setError(errorMsg);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-foreground/50" />
      </div>
    );
  }

  // Require authentication to checkout
  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-2xl md:px-4 md:py-16 md:text-center">
        <LogIn className="mx-auto mb-6 hidden h-24 w-24 text-foreground/15 md:block" />
        <h1 className="mobile-h1 text-2xl font-bold text-foreground md:mb-4">Sign In Required</h1>
        <p className="mt-3 text-base text-foreground/70 md:mt-0 md:mb-8">
          Please sign in or create an account to proceed with checkout.
        </p>
        <div className="mt-6 grid gap-2 md:mt-0 md:flex md:flex-row md:justify-center md:gap-4">
          <Button
            onClick={() => setShowLoginModal(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 py-4 w-full text-[13px] md:w-auto md:text-sm"
          >
            Sign In
          </Button>
          <Button
            onClick={() => setShowRegisterModal(true)}
            variant="outline"
            className="font-semibold px-8 py-4 w-full text-[13px] md:w-auto md:text-sm"
          >
            Create Account
          </Button>
        </div>
        <Link
          href="/cart"
          className="mt-6 inline-flex items-center text-sm text-primary transition-colors cursor-pointer md:mt-8 md:text-base md:text-foreground/65 md:hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Cart
        </Link>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="mx-auto max-w-2xl md:px-4 md:py-16 md:text-center">
        <ShoppingCart className="mx-auto mb-6 hidden h-24 w-24 text-foreground/15 md:block" />
        <h1 className="mobile-h1 text-2xl font-bold text-foreground md:mb-4">Your cart is empty</h1>
        <p className="mt-3 text-base text-foreground/70 md:mt-0 md:mb-8">
          Add some items to your cart to proceed with checkout.
        </p>
        <Link
          href="/"
          className="mt-6 flex h-12 w-full items-center justify-center bg-primary text-[13px] font-semibold uppercase tracking-[0.08em] text-primary-foreground transition-colors hover:bg-primary/90 cursor-pointer md:mt-0 md:inline-block md:h-auto md:w-auto md:px-8 md:py-4 md:text-base md:normal-case md:tracking-normal md:transition-all"
        >
          Browse Listings
        </Link>
      </div>
    );
  }

  const paypalAddress = savedAddress || EMPTY_ADDRESS;

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Phone composition: summary, ship-to, payment, then the pay action    */}
      {/* beside the total in the sticky bar.                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="md:hidden">
        <h1 className="font-heading text-[30px] leading-[0.98] text-foreground">Checkout</h1>

        <div className="mt-4 border border-foreground/20 px-[18px] py-4">
          {cartItems.length === 1 ? (
            <div className="flex items-baseline justify-between gap-3 text-[15px] leading-[1.4]">
              <span className="truncate text-foreground/65">{cartItems[0].title}</span>
              <span className="shrink-0 tabular-nums">{formatExact(cartItems[0].price, currency)}</span>
            </div>
          ) : (
            <div className="flex items-baseline justify-between gap-3 text-[15px] leading-[1.4]">
              <span className="text-foreground/65">{cartItems.length} guitars</span>
              <span className="tabular-nums">{formatExact(subtotal, currency)}</span>
            </div>
          )}
          <div className="mt-2 flex items-baseline justify-between gap-3 text-[15px] leading-[1.4]">
            <span className="text-foreground/65">Shipping</span>
            <span className="label-mono text-primary">Free &amp; insured</span>
          </div>
          {paymentMethod === 'paypal' && (
            <div className="mt-2 flex items-baseline justify-between gap-3 text-[15px] leading-[1.4]">
              <span className="text-foreground/65">PayPal fee (3.5%)</span>
              <span className="tabular-nums">{formatExact(paypalFee, currency)}</span>
            </div>
          )}
          {creditBalance > 0 && (
            <label className="mt-2 flex h-12 cursor-pointer items-center gap-3.5">
              <input
                type="checkbox"
                checked={applyCredit}
                onChange={e => setApplyCredit(e.target.checked)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center border-[1.5px] peer-focus-visible:ring-1 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
                  applyCredit ? 'border-primary bg-primary text-primary-foreground' : 'border-foreground/40'
                )}
              >
                {applyCredit && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </span>
              <span className="flex-1 text-[15px] leading-[1.3]">
                Apply store credit ({formatPrice(creditBalance, currency)} available)
              </span>
              {applyCredit && (
                <span className="label-mono shrink-0 text-primary">-{formatPrice(creditApplied, currency)}</span>
              )}
            </label>
          )}
        </div>

        <p className="label-mono mt-7 mb-3 text-primary">Ship to</p>
        {hasValidAddress && savedAddress ? (
          <>
            <address className="border border-foreground/35 px-3.5 py-3 text-base not-italic leading-[1.5] text-foreground">
              <p className="font-semibold">{savedAddress.fullName}</p>
              <p>{savedAddress.line1}</p>
              {savedAddress.line2 && <p>{savedAddress.line2}</p>}
              <p>
                {savedAddress.city}, {savedAddress.state} {savedAddress.postalCode}
              </p>
              <p>{savedAddress.country}</p>
            </address>
            <button
              type="button"
              onClick={() => setAddressModalOpen(true)}
              className="font-btn mt-2 flex h-12 w-full cursor-pointer items-center justify-center border border-foreground text-[13px] text-foreground transition-colors hover:bg-foreground hover:text-background"
            >
              Edit address
            </button>
          </>
        ) : (
          <>
            <StateBlock variant="warning">
              Add a shipping address — it is required to ship the guitar.
            </StateBlock>
            <button
              type="button"
              onClick={() => setAddressModalOpen(true)}
              className="font-btn mt-2 flex h-12 w-full cursor-pointer items-center justify-center bg-foreground text-[13px] text-background transition-colors hover:bg-foreground/90"
            >
              Add shipping address
            </button>
          </>
        )}

        <p className="label-mono mt-7 mb-3 text-primary">Payment</p>
        {/* A different radio name from the desktop group: both groups are always in the
            DOM, and radios sharing a name uncheck each other across the two copies. */}
        <div className="grid gap-2">
          {PAYMENT_OPTIONS.map((option) => {
            const selected = paymentMethod === option.value;
            return (
              <label
                key={option.value}
                className={cn(
                  'flex min-h-14 cursor-pointer items-center gap-3.5 border-[1.5px] px-4 transition-colors',
                  selected ? 'border-primary bg-primary/6' : 'border-foreground/25'
                )}
              >
                <input
                  type="radio"
                  name="paymentMethodPhone"
                  value={option.value}
                  checked={selected}
                  onChange={() => setPaymentMethod(option.value)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className={cn(
                    'h-[18px] w-[18px] shrink-0 border-[1.5px] peer-focus-visible:ring-1 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
                    selected ? 'border-primary bg-primary' : 'border-foreground/35'
                  )}
                />
                <span className="py-2.5">
                  <span className="block text-base font-semibold leading-[1.2] text-foreground">{option.label}</span>
                  <span className="mt-0.5 block text-[13px] leading-[1.3] text-foreground/60">
                    {option.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        {error && (
          <StateBlock variant="error" className="mt-4">
            {error}
          </StateBlock>
        )}

        <p className="mt-4 text-[13px] leading-[1.5] text-foreground/60">
          Secure payment powered by {paymentMethod === 'stripe' ? 'Stripe' : 'PayPal'}
        </p>

        <Link href="/cart" className="mt-5 inline-flex items-center gap-2 text-sm text-primary">
          <ArrowLeft className="h-4 w-4" />
          Back to cart
        </Link>

        <StickyBar className="grid grid-cols-[auto_1fr] gap-3">
          <div>
            <p className="label-mono-sm text-foreground/55">Total</p>
            <p className="mt-0.5 font-heading text-[22px] leading-none text-foreground">
              {formatPrice(totalAfterCredit, currency)}
            </p>
          </div>
          {paymentMethod === 'stripe' ? (
            <button
              type="button"
              onClick={handleCheckout}
              disabled={checkoutLoading || !hasValidAddress}
              className="font-btn flex h-12 cursor-pointer items-center justify-center gap-2 bg-primary text-[13px] text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {checkoutLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing…
                </>
              ) : (
                `Pay ${formatPrice(totalAfterCredit, currency)}`
              )}
            </button>
          ) : (
            <div className="min-w-0">
              <PayPalCheckoutButton
                compact
                cartItems={cartItems}
                shippingAddress={paypalAddress}
                total={total}
                currency={currency}
                disabled={!hasValidAddress}
                useAuth={true}
                applyStoreCredit={applyCredit}
                onSuccess={handlePayPalSuccess}
                onError={handlePayPalError}
              />
            </div>
          )}
        </StickyBar>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Desktop composition (md and up): the two-column page as it was.     */}
      {/* ------------------------------------------------------------------ */}
      <div className="hidden md:block">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/cart"
            className="inline-flex items-center text-foreground/65 hover:text-foreground mb-6 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Cart
          </Link>

          <h1 className="text-3xl font-bold text-foreground mb-8">Checkout</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Shipping Address & Order Summary */}
            <div className="lg:col-span-2 space-y-8">
              {/* Shipping Address Section */}
              <div className="bg-background rounded-lg border border-foreground/15 p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">Shipping Address</h2>

                {hasValidAddress && savedAddress ? (
                  // Show saved address card
                  <div
                    className="p-4 border border-foreground/15 rounded-lg hover:border-primary hover:bg-primary/6 cursor-pointer transition-all group"
                    onClick={() => setAddressModalOpen(true)}
                  >
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-foreground/50 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{savedAddress.fullName}</p>
                        <p className="text-foreground/65 text-sm">{savedAddress.line1}</p>
                        {savedAddress.line2 && (
                          <p className="text-foreground/65 text-sm">{savedAddress.line2}</p>
                        )}
                        <p className="text-foreground/65 text-sm">
                          {savedAddress.city}, {savedAddress.state} {savedAddress.postalCode}
                        </p>
                        <p className="text-foreground/65 text-sm">{savedAddress.country}</p>
                      </div>
                      <button
                        className="p-2 text-foreground/50 hover:text-primary group-hover:text-primary transition-colors cursor-pointer"
                        aria-label="Edit shipping address"
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
                    className="w-full p-6 border-2 border-dashed border-foreground/25 rounded-lg hover:border-primary hover:bg-primary/6 transition-all flex flex-col items-center gap-2 text-foreground/60 hover:text-primary cursor-pointer"
                  >
                    <Plus className="h-8 w-8" />
                    <span className="font-medium">Add Shipping Address</span>
                    <span className="text-sm">Required to continue with checkout</span>
                  </button>
                )}
              </div>

              {/* Order Summary */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Order Summary</h2>
                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-4 p-4 bg-background rounded-lg border border-foreground/15"
                  >
                    <div className="relative w-20 h-20 flex-shrink-0 rounded overflow-hidden bg-foreground/5">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.title}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">
                          🎸
                        </div>
                      )}
                    </div>
                    <div className="flex-grow min-w-0">
                      <h3 className="font-medium text-foreground truncate">{item.title}</h3>
                      <p className="text-lg font-semibold text-foreground mt-1">
                        {formatPrice(item.price, item.currency)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Summary */}
            <div className="lg:col-span-1">
              <div className="bg-background rounded-lg border border-foreground/15 p-6 lg:sticky lg:top-[calc(var(--header-h)+16px)]">
                <h2 className="text-lg font-semibold text-foreground mb-4">Payment Summary</h2>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-foreground/65">
                    <span>Subtotal ({cartItems.length} item{cartItems.length !== 1 ? 's' : ''})</span>
                    <span>{formatPrice(subtotal, currency)}</span>
                  </div>
                  <div className="flex justify-between text-foreground/65">
                    <span>Shipping</span>
                    <span className="label-mono text-primary">Free &amp; insured</span>
                  </div>
                  {paymentMethod === 'paypal' && (
                    <div className="flex justify-between text-foreground/65">
                      <span>PayPal Fee (3.5%)</span>
                      <span>{formatPrice(paypalFee, currency)}</span>
                    </div>
                  )}
                  {creditBalance > 0 && (
                    <div className="flex items-center justify-between bg-primary/6 border border-primary rounded p-2">
                      <label className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                        <input type="checkbox" checked={applyCredit} onChange={e => setApplyCredit(e.target.checked)} />
                        <span>Apply store credit ({formatPrice(creditBalance, currency)} available)</span>
                      </label>
                      {applyCredit && <span className="text-sm font-semibold text-primary">-{formatPrice(creditApplied, currency)}</span>}
                    </div>
                  )}
                  <div className="border-t pt-3 flex justify-between font-semibold text-lg text-foreground">
                    <span>Total</span>
                    <span>{formatPrice(totalAfterCredit, currency)}</span>
                  </div>
                </div>

                {/* Payment Method Selection */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-foreground/78 mb-3">Payment Method</h3>
                  <div className="space-y-2">
                    <label
                      className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${
                        paymentMethod === 'stripe'
                          ? 'border-primary bg-primary/6'
                          : 'border-foreground/15 hover:border-foreground/25'
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
                      <CreditCard className="h-5 w-5 text-foreground/65 mr-3" />
                      <span className="flex-1 font-medium text-foreground">Credit Card</span>
                      <span className="text-xs text-foreground/60">Powered by Stripe</span>
                    </label>
                    <label
                      className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${
                        paymentMethod === 'paypal'
                          ? 'border-primary bg-primary/6'
                          : 'border-foreground/15 hover:border-foreground/25'
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
                      <span className="flex-1 font-medium text-foreground">PayPal</span>
                    </label>
                  </div>
                </div>

                {error && (
                  <StateBlock variant="error" className="mb-4">
                    {error}
                  </StateBlock>
                )}

                {paymentMethod === 'stripe' ? (
                  <>
                    <Button
                      onClick={handleCheckout}
                      disabled={checkoutLoading || !hasValidAddress}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <p className="text-xs text-foreground/60 text-center mt-4">
                      Secure payment powered by Stripe
                    </p>
                  </>
                ) : (
                  <div>
                    <PayPalCheckoutButton
                      cartItems={cartItems}
                      shippingAddress={paypalAddress}
                      total={total}
                      currency={currency}
                      disabled={!hasValidAddress}
                      useAuth={true}
                      applyStoreCredit={applyCredit}
                      onSuccess={handlePayPalSuccess}
                      onError={handlePayPalError}
                    />
                    <p className="text-xs text-foreground/60 text-center mt-4">
                      Secure payment powered by PayPal
                    </p>
                  </div>
                )}
              </div>
            </div>
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
    </>
  );
}
