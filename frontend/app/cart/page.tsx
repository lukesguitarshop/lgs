'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StateBlock } from '@/components/ui/state-block';
import { StickyBar } from '@/components/ui/sticky-bar';
import { ShoppingCart, Trash2, ArrowLeft, Lock, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { CartItem, getCart, removeFromCart } from '@/lib/cart';
import { trackRemoveFromCart } from '@/lib/analytics';
import { cn } from '@/lib/utils';

interface PendingCartItemResponse {
  id: string;
  listingId: string;
  offerId: string;
  reservationId: string | null;
  title: string;
  image: string;
  /** Balance due — already net of deposit and trade-in credit, computed server-side. */
  price: number;
  agreedPrice: number;
  depositPaid: number;
  tradeInCredit: number;
  currency: string;
  isLocked: boolean;
  createdAt: string;
  /** Null means this lock never expires (deposit-backed). */
  expiresAt: string | null;
}

function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/** Credits and balances need cents; the headline prices don't. */
function formatExact(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

function lockTitle(item: CartItem): string {
  return (item.depositPaid ?? 0) > 0
    ? "This item is secured with a deposit and can't be removed. Contact us if you need to cancel."
    : 'This item is reserved and cannot be removed.';
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
          reservationId: item.reservationId ?? undefined,
          agreedPrice: item.agreedPrice,
          depositPaid: item.depositPaid,
          tradeInCredit: item.tradeInCredit,
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
  const hasDepositItems = pendingItems.some((item) => (item.depositPaid ?? 0) > 0);
  const reservedNotice = hasDepositItems
    ? "These items are secured with a deposit and can't be removed. Contact us if you need to cancel."
    : 'You have items reserved for you. These are added automatically and cannot be removed.';

  // item.price is already the balance due for reservation-backed lines.
  const total = cartItems.reduce((sum, item) => sum + item.price, 0);
  const totalDeposits = cartItems.reduce((sum, item) => sum + (item.depositPaid ?? 0), 0);
  const totalTradeIn = cartItems.reduce((sum, item) => sum + (item.tradeInCredit ?? 0), 0);
  const grossTotal = total + totalDeposits + totalTradeIn;
  const currency = cartItems[0]?.currency || 'USD';
  const totalLabel = totalDeposits > 0 || totalTradeIn > 0 ? 'Balance due' : 'Total';

  if (loading || loadingPending) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-pulse text-foreground/50">Loading cart...</div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="mx-auto max-w-2xl md:px-4 md:py-16 md:text-center">
        <ShoppingCart className="mx-auto mb-6 hidden h-24 w-24 text-foreground/15 md:block" />
        <h1 className="mobile-h1 text-2xl font-bold text-foreground md:mb-4">Your cart is empty</h1>
        <p className="mt-3 text-base text-foreground/70 md:mt-0 md:mb-8">
          Looks like you haven&apos;t added anything to your cart yet.
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

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Phone composition: the money first, the line items under it, and    */}
      {/* the total beside the one action in the sticky bar — never twice.    */}
      {/* ------------------------------------------------------------------ */}
      <div className="md:hidden">
        <h1 className="font-heading text-[30px] leading-[0.98] text-foreground">Shopping cart</h1>

        <div className="mt-4 border border-foreground/20 px-[18px] py-4">
          <div className="flex items-baseline justify-between gap-3 text-[15px] leading-[1.4]">
            <span className="text-foreground/65">Subtotal</span>
            <span className="tabular-nums">{formatExact(grossTotal, currency)}</span>
          </div>
          {totalDeposits > 0 && (
            <div className="mt-2 flex items-baseline justify-between gap-3 text-[15px] leading-[1.4]">
              <span className="text-foreground/65">Deposits already paid</span>
              <span className="tabular-nums">-{formatExact(totalDeposits, currency)}</span>
            </div>
          )}
          {totalTradeIn > 0 && (
            <div className="mt-2 flex items-baseline justify-between gap-3 text-[15px] leading-[1.4]">
              <span className="text-foreground/65">Trade-in credit</span>
              <span className="tabular-nums">-{formatExact(totalTradeIn, currency)}</span>
            </div>
          )}
          <div className="mt-2 flex items-baseline justify-between gap-3 text-[15px] leading-[1.4]">
            <span className="text-foreground/65">Shipping</span>
            <span className="label-mono text-primary">Free &amp; insured</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-3 text-[15px] leading-[1.4]">
            <span className="text-foreground/65">Tax</span>
            <span className="text-foreground/50">At checkout</span>
          </div>
        </div>

        <p className="label-mono mt-7 mb-3 text-foreground/55">
          {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}
        </p>

        {cartItems.map((item, index) => {
          const hasCredits = (item.depositPaid ?? 0) > 0 || (item.tradeInCredit ?? 0) > 0;
          return (
            <div
              key={item.id}
              className={cn(
                'grid grid-cols-[96px_1fr] gap-3.5 border-t border-foreground/15 pt-4',
                index > 0 && 'mt-4'
              )}
            >
              <Link
                href={`/listing/${item.id}`}
                className="photo-panel relative aspect-[4/5] overflow-hidden border border-foreground/15"
              >
                {item.image && (
                  <Image src={item.image} alt={item.title} fill sizes="96px" className="object-cover" />
                )}
              </Link>
              <div className="min-w-0">
                <div className="flex justify-between gap-2.5">
                  <Link
                    href={`/listing/${item.id}`}
                    className="text-[15px] font-semibold leading-[1.3] text-pretty text-foreground"
                  >
                    {item.title}
                  </Link>
                  {item.isLocked ? (
                    <span
                      role="img"
                      aria-label={lockTitle(item)}
                      title={lockTitle(item)}
                      className="-mt-2.5 -mr-2.5 flex h-11 w-11 shrink-0 items-center justify-center text-foreground/50"
                    >
                      <Lock className="h-5 w-5" />
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      aria-label="Remove item"
                      className="-mt-2.5 -mr-2.5 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center text-foreground/50 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
                <p className="mt-2.5 font-heading text-[22px] leading-none text-foreground">
                  {formatPrice(item.price, item.currency)}
                </p>
                {item.isLocked && (
                  <p className="label-mono mt-1.5 text-primary">
                    {(item.depositPaid ?? 0) > 0 ? 'Secured with deposit' : 'Reserved'}
                  </p>
                )}
                {/* Credit breakdown for reservation-backed lines. Every figure here comes
                    from the server; the browser never computes a price. */}
                {item.isLocked && hasCredits && (
                  <div className="mt-2 text-[13px] leading-[1.5] text-foreground/65">
                    <div className="flex justify-between gap-3">
                      <span>Agreed price</span>
                      <span className="tabular-nums">
                        {formatExact(item.agreedPrice ?? item.price, item.currency)}
                      </span>
                    </div>
                    {(item.depositPaid ?? 0) > 0 && (
                      <div className="flex justify-between gap-3">
                        <span>Deposit paid</span>
                        <span className="tabular-nums">-{formatExact(item.depositPaid!, item.currency)}</span>
                      </div>
                    )}
                    {(item.tradeInCredit ?? 0) > 0 && (
                      <div className="flex justify-between gap-3">
                        <span>Trade-in credit</span>
                        <span className="tabular-nums">-{formatExact(item.tradeInCredit!, item.currency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-3 font-semibold text-foreground">
                      <span>Balance due</span>
                      <span className="tabular-nums">{formatExact(item.price, item.currency)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {hasLockedItems && (
          <StateBlock variant="success" label="Reserved for you" className="mt-6">
            {reservedNotice}
          </StateBlock>
        )}

        <Link href="/" className="mt-5 block text-sm text-primary">
          ← Keep browsing
        </Link>

        <StickyBar className="grid grid-cols-[auto_1fr] gap-3">
          <div>
            <p className="label-mono-sm text-foreground/55">{totalLabel}</p>
            <p className="mt-0.5 font-heading text-[22px] leading-none text-foreground tabular-nums">
              {formatExact(total, currency)}
            </p>
          </div>
          <Link
            href="/checkout"
            className="font-btn flex h-12 items-center justify-center bg-primary text-[13px] text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Checkout →
          </Link>
        </StickyBar>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Desktop composition (md and up): the two-column page as it was.     */}
      {/* ------------------------------------------------------------------ */}
      <div className="hidden md:block">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center text-foreground/65 hover:text-foreground mb-6 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Continue Shopping
          </Link>

          <h1 className="text-3xl font-bold text-foreground mb-8">Shopping Cart</h1>

          {hasLockedItems && (
            <StateBlock variant="success" label="Reserved Items" className="mb-6">
              {reservedNotice}
            </StateBlock>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex gap-4 p-4 bg-background rounded-lg border ${
                    item.isLocked
                      ? 'border-primary ring-1 ring-primary/30'
                      : 'border-foreground/15'
                  }`}
                >
                  <Link
                    href={`/listing/${item.id}`}
                    className="relative w-24 h-24 flex-shrink-0 rounded overflow-hidden bg-foreground/5 hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.title}
                        fill
                        sizes="96px"
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
                        <h3 className="font-medium text-foreground hover:text-primary transition-colors line-clamp-2">
                          {item.title}
                        </h3>
                      </Link>
                      {item.isLocked && (
                        <span className="label-mono-sm inline-flex items-center gap-1 text-primary">
                          <Lock className="h-3 w-3" />
                          {(item.depositPaid ?? 0) > 0 ? 'Secured with deposit' : 'Reserved'}
                        </span>
                      )}
                    </div>

                    {/* Credit breakdown for reservation-backed lines. Every figure here comes
                        from the server; the browser never computes a price. */}
                    {item.isLocked && ((item.depositPaid ?? 0) > 0 || (item.tradeInCredit ?? 0) > 0) ? (
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex justify-between text-foreground/78">
                          <span>{item.title}</span>
                          <span className="tabular-nums">
                            {formatExact(item.agreedPrice ?? item.price, item.currency)}
                          </span>
                        </div>
                        {(item.depositPaid ?? 0) > 0 && (
                          <div className="flex justify-between pl-3 text-foreground/65">
                            <span>Deposit paid</span>
                            <span className="tabular-nums">
                              -{formatExact(item.depositPaid!, item.currency)}
                            </span>
                          </div>
                        )}
                        {(item.tradeInCredit ?? 0) > 0 && (
                          <div className="flex justify-between pl-3 text-foreground/65">
                            <span>Trade-in credit</span>
                            <span className="tabular-nums">
                              -{formatExact(item.tradeInCredit!, item.currency)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between border-t border-foreground/15 pt-1 font-semibold text-foreground">
                          <span>Balance due</span>
                          <span className="tabular-nums">{formatExact(item.price, item.currency)}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-lg font-semibold text-foreground mt-2">
                        {formatPrice(item.price, item.currency)}
                      </p>
                    )}
                  </div>
                  {item.isLocked ? (
                    <div
                      className="flex-shrink-0 p-2 text-primary cursor-not-allowed"
                      title={lockTitle(item)}
                    >
                      <Lock className="h-5 w-5" />
                    </div>
                  ) : (
                    <button
                      onClick={() => removeItem(item.id)}
                      className="flex-shrink-0 p-2 text-foreground/50 hover:text-primary transition-colors cursor-pointer"
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
              <div className="bg-background rounded-lg border border-foreground/15 p-6 lg:sticky lg:top-[calc(var(--header-h)+16px)]">
                <h2 className="text-lg font-semibold text-foreground mb-4">Order Summary</h2>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-foreground/65">
                    <span>Subtotal ({cartItems.length} item{cartItems.length !== 1 ? 's' : ''})</span>
                    <span className="tabular-nums">{formatExact(grossTotal, currency)}</span>
                  </div>
                  {totalDeposits > 0 && (
                    <div className="flex justify-between text-foreground/65">
                      <span>Deposits already paid</span>
                      <span className="tabular-nums">-{formatExact(totalDeposits, currency)}</span>
                    </div>
                  )}
                  {totalTradeIn > 0 && (
                    <div className="flex justify-between text-foreground/65">
                      <span>Trade-in credit</span>
                      <span className="tabular-nums">-{formatExact(totalTradeIn, currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-foreground/65">
                    <span>Shipping</span>
                    <span className="label-mono text-primary">Free &amp; insured</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between font-semibold text-lg text-foreground">
                    <span>{totalLabel}</span>
                    <span className="tabular-nums">{formatExact(total, currency)}</span>
                  </div>
                </div>

                <Link href="/checkout">
                  <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6 text-base tracking-normal">
                    Proceed to Checkout
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
