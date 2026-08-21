'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  formatOrderCurrency,
  formatOrderDateTime,
  getStatusDisplay,
  getTrackingUrl,
  orderNumber,
  orderTimeline,
} from '@/lib/orders';
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Guitar,
  Loader2,
  MapPin,
  MessageSquare,
  Package,
  Receipt,
  Star,
  Truck,
} from 'lucide-react';

interface OrderDetailItem {
  listingId: string;
  listingTitle: string;
  price: number;
  currency: string;
  quantity: number;
  image: string | null;
  listingAvailable: boolean;
}

interface OrderShippingAddress {
  fullName: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface OrderDetail {
  id: string;
  paymentMethod: string;
  orderType: string;
  status: string;
  createdAt: string;
  items: OrderDetailItem[];
  shippingAddress: OrderShippingAddress | null;
  itemsSubtotal: number;
  processingFee: number;
  storeCreditApplied: number;
  depositApplied: number;
  amountPaid: number;
  totalAmount: number;
  currency: string;
  trackingCarrier: string | null;
  trackingNumber: string | null;
  buyerEmail: string | null;
  reviewId: string | null;
  reviewRating: number | null;
}

function paymentMethodLabel(method: string): string {
  switch (method.toLowerCase()) {
    case 'stripe':
      return 'Card (Stripe)';
    case 'paypal':
      return 'PayPal';
    default:
      return method;
  }
}

export default function CustomerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { isAuthenticated, isLoading: authLoading, setShowLoginModal } = useAuth();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await api.authGet<OrderDetail>(`/auth/orders/${id}`);
        if (!cancelled) setOrder(data);
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message: string }).message)
            : 'We could not load this order.';
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, isAuthenticated, authLoading]);

  const copy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  if (authLoading || loading) {
    return (
      <div className="container mx-auto px-4 py-16 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Package className="h-12 w-12 mx-auto text-gray-300 mb-4" />
        <h1 className="font-heading text-3xl text-[#6E0114] mb-3">
          Sign in to view this order
        </h1>
        <p className="text-gray-600 mb-6">Your order details live on your account.</p>
        <Button
          onClick={() => setShowLoginModal(true)}
          className="bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3]"
        >
          Sign in
        </Button>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/profile"
            className="inline-flex items-center text-gray-600 hover:text-[#020E1C] mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to my profile
          </Link>
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-600">
                {error || 'That order is not on your account.'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isDeposit = order.orderType === 'deposit';
  const hasTracking = Boolean(order.trackingCarrier && order.trackingNumber);
  const steps = orderTimeline(order.status, hasTracking);
  const trackingUrl = hasTracking
    ? getTrackingUrl(order.trackingCarrier!, order.trackingNumber!)
    : null;
  const address = order.shippingAddress;
  const addressText = address
    ? [
        address.fullName,
        address.line1,
        address.line2,
        `${address.city}, ${address.state} ${address.postalCode}`,
        address.country,
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/profile"
          className="inline-flex items-center text-gray-600 hover:text-[#020E1C] mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to my profile
        </Link>

        {/* Header */}
        <div className="mb-8">
          <p className="text-sm uppercase tracking-wide text-gray-500 mb-1">
            {isDeposit ? 'Reservation deposit' : 'Order'}
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl text-[#6E0114] mb-2">
            #{orderNumber(order.id)}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-gray-600">
            <span>Placed {formatOrderDateTime(order.createdAt)}</span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#020E1C] text-[#FFFFF3]">
              {getStatusDisplay(order.status)}
            </span>
          </div>
          <button
            onClick={() => copy(order.id, 'orderId')}
            className="mt-3 inline-flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-gray-700"
            title="Copy the full order id"
          >
            {order.id}
            {copied === 'orderId' ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        </div>

        {/* Progress */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5" />
              Where your order is
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol>
              {steps.map((step, idx) => (
                <li key={step.stage} className="flex gap-4 pb-6 last:pb-0">
                  <div className="flex flex-col items-center">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                        step.done
                          ? 'border-[#6E0114] bg-[#6E0114] text-[#FFFFF3]'
                          : 'border-gray-300 bg-white text-gray-400'
                      }`}
                    >
                      {step.done ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <span className="text-xs font-semibold">{idx + 1}</span>
                      )}
                    </span>
                    {idx < steps.length - 1 && (
                      <span
                        className={`w-0.5 flex-1 mt-1 ${
                          steps[idx + 1].done ? 'bg-[#6E0114]' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                  <div className="pt-1">
                    <p
                      className={`font-medium ${
                        step.done ? 'text-[#020E1C]' : 'text-gray-400'
                      }`}
                    >
                      {step.label}
                      {step.current && (
                        <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-[#6E0114]">
                          Current
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Tracking */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Truck className="h-5 w-5" />
              Tracking
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasTracking ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-[#020E1C]/5 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-500">Carrier</p>
                    <p className="font-medium">{order.trackingCarrier}</p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-sm text-gray-500">Tracking number</p>
                    <div className="flex items-center gap-2 sm:justify-end">
                      <span className="font-mono font-medium">{order.trackingNumber}</span>
                      <button
                        onClick={() => copy(order.trackingNumber!, 'tracking')}
                        className="text-gray-400 hover:text-gray-700"
                        title="Copy tracking number"
                      >
                        {copied === 'tracking' ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                {trackingUrl && (
                  <a href={trackingUrl} target="_blank" rel="noopener noreferrer">
                    <Button className="bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3]">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Track this package
                    </Button>
                  </a>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <Truck className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-600">
                  No tracking yet. We&rsquo;ll email you the moment your guitar ships.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Items */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Guitar className="h-5 w-5" />
              What you bought
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-gray-200">
              {order.items.map((item, idx) => (
                <div
                  key={`${item.listingId}-${idx}`}
                  className="flex gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.listingTitle}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Guitar className="h-8 w-8 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {item.listingAvailable ? (
                      <Link
                        href={`/listing/${item.listingId}`}
                        className="font-medium text-[#020E1C] hover:text-[#6E0114]"
                      >
                        {item.listingTitle}
                      </Link>
                    ) : (
                      <p className="font-medium text-[#020E1C]">{item.listingTitle}</p>
                    )}
                    {item.quantity > 1 && (
                      <p className="text-sm text-gray-500 mt-1">Quantity: {item.quantity}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold">
                      {formatOrderCurrency(item.price * item.quantity, item.currency)}
                    </p>
                    {item.quantity > 1 && (
                      <p className="text-sm text-gray-500">
                        {formatOrderCurrency(item.price, item.currency)} each
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Payment summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Receipt className="h-5 w-5" />
                Payment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Subtotal</dt>
                  <dd>{formatOrderCurrency(order.itemsSubtotal, order.currency)}</dd>
                </div>
                {order.processingFee > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">PayPal fee</dt>
                    <dd>{formatOrderCurrency(order.processingFee, order.currency)}</dd>
                  </div>
                )}
                {order.depositApplied > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Deposit already paid</dt>
                    <dd className="text-green-700">
                      &minus;{formatOrderCurrency(order.depositApplied, order.currency)}
                    </dd>
                  </div>
                )}
                {order.storeCreditApplied > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Store credit</dt>
                    <dd className="text-green-700">
                      &minus;{formatOrderCurrency(order.storeCreditApplied, order.currency)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-3 mt-3">
                  <dt className="font-medium text-[#020E1C]">Charged</dt>
                  <dd className="text-xl font-bold text-[#6E0114]">
                    {formatOrderCurrency(order.amountPaid, order.currency)}
                  </dd>
                </div>
                <div className="flex justify-between pt-2">
                  <dt className="text-gray-500">Paid with</dt>
                  <dd>{paymentMethodLabel(order.paymentMethod)}</dd>
                </div>
                {order.buyerEmail && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500 shrink-0">Receipt sent to</dt>
                    <dd className="truncate">{order.buyerEmail}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Shipping address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5" />
                Shipping to
              </CardTitle>
            </CardHeader>
            <CardContent>
              {address ? (
                <>
                  <div className="space-y-1 text-sm mb-4">
                    <p className="font-medium">{address.fullName}</p>
                    <p className="text-gray-600">{address.line1}</p>
                    {address.line2 && <p className="text-gray-600">{address.line2}</p>}
                    <p className="text-gray-600">
                      {address.city}, {address.state} {address.postalCode}
                    </p>
                    <p className="text-gray-600">{address.country}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copy(addressText, 'address')}
                    className="w-full"
                  >
                    {copied === 'address' ? (
                      <>
                        <Check className="h-4 w-4 mr-2 text-green-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy address
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <p className="text-gray-600 text-sm">No shipping address on this order.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Next steps */}
        <Card>
          <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="font-medium text-[#020E1C]">
                {order.reviewId ? 'Thanks for the review' : 'How did we do?'}
              </p>
              <p className="text-sm text-gray-600">
                {order.reviewId
                  ? `You rated this order ${order.reviewRating} out of 5.`
                  : 'Tell other players about your experience with this order.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={`/review?order=${order.id}`}>
                <Button className="bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3]">
                  <Star className="h-4 w-4 mr-2" />
                  {order.reviewId ? 'Edit your review' : 'Write a review'}
                </Button>
              </Link>
              <Link href="/contact">
                <Button variant="outline">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Get help
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
