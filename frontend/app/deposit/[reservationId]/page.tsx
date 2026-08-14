'use client';

import { useState, useEffect, use } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { Button } from '@/components/ui/button';
import { Loader2, Lock, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getDepositDetails,
  createDepositStripeSession,
  createDepositPayPalOrder,
  captureDepositPayPalOrder,
} from '@/lib/api';
import { formatCurrency, relativeExpiry, type DepositDetails } from '@/lib/types/reservation';
import { refreshPendingCart } from '@/lib/cart';

/**
 * Dedicated deposit checkout. Contains only the deposit line item — no shipping is
 * charged, no address is collected, and no tax is applied. Tax and shipping, where
 * they apply, belong on the balance order.
 */
export default function DepositCheckoutPage({
  params,
}: {
  params: Promise<{ reservationId: string }>;
}) {
  const { reservationId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading, setShowLoginModal } = useAuth();

  const [details, setDetails] = useState<DepositDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState<'card' | 'paypal'>('card');

  const cancelled = searchParams.get('cancelled') === '1';

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setLoading(false);
      setShowLoginModal(true);
      return;
    }

    let active = true;
    getDepositDetails(reservationId)
      .then((data) => {
        if (active) setDetails(data);
      })
      .catch((err) => {
        if (active) {
          setError(
            err && typeof err === 'object' && 'message' in err
              ? String((err as { message: unknown }).message)
              : 'Could not load this deposit.'
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reservationId, isAuthenticated, authLoading, setShowLoginModal]);

  const handleStripe = async () => {
    setPaying(true);
    setError(null);
    try {
      const { sessionUrl } = await createDepositStripeSession(reservationId);
      window.location.href = sessionUrl;
    } catch (err) {
      setError(
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Could not start the deposit checkout.'
      );
      setPaying(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#6E0114]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <Lock className="mx-auto h-8 w-8 text-gray-400" />
        <h1 className="mt-3 text-xl font-semibold">Sign in to pay your deposit</h1>
        <Button className="mt-4" onClick={() => setShowLoginModal(true)}>
          Sign in
        </Button>
      </div>
    );
  }

  if (error && !details) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
        <h1 className="mt-3 text-xl font-semibold">We couldn&apos;t load this deposit</h1>
        <p className="mt-2 text-sm text-gray-600">{error}</p>
        <Link href="/" className="mt-4 inline-block text-[#6E0114] underline">
          Back to the shop
        </Link>
      </div>
    );
  }

  if (!details) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href={`/listing/${details.listing_id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to the listing
      </Link>

      <h1 className="font-nav text-2xl text-[#020E1C]">Pay your deposit</h1>
      <p className="mt-1 text-sm text-gray-600">
        This secures the guitar for you. You&apos;ll pay the balance when you&apos;re ready to
        complete the purchase.
      </p>

      {cancelled && (
        <div className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          That payment was cancelled. Your hold is still in place — you can try again below.
        </div>
      )}

      {/* Line item */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex gap-3">
          {details.listing_image ? (
            <Image
              src={details.listing_image}
              alt=""
              width={80}
              height={80}
              className="h-20 w-20 shrink-0 rounded object-cover"
            />
          ) : (
            <div className="h-20 w-20 shrink-0 rounded bg-gray-100" />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-medium text-gray-900">{details.line_item_label}</div>
            <div className="mt-0.5 text-sm text-gray-500">
              Guitar price {formatCurrency(details.agreed_price, details.currency)}
            </div>
          </div>
          <div className="shrink-0 text-right font-semibold tabular-nums">
            {formatCurrency(details.deposit_amount, details.currency)}
          </div>
        </div>

        <div className="mt-4 space-y-1 border-t border-gray-100 pt-3 text-sm">
          <Row label="Guitar price" value={formatCurrency(details.agreed_price, details.currency)} />
          {details.trade_in_credit > 0 && (
            <Row
              label="Trade-in credit"
              value={`-${formatCurrency(details.trade_in_credit, details.currency)}`}
            />
          )}
          <Row
            label="Deposit today"
            value={formatCurrency(details.deposit_amount, details.currency)}
            strong
          />
          <Row
            label="Balance due later"
            value={formatCurrency(details.balance_after_deposit, details.currency)}
          />
          <Row label="Shipping" value="Not charged on a deposit" muted />
          <Row label="Tax" value="Not charged on a deposit" muted />
        </div>

        <div className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
          This deposit is{' '}
          <strong>{details.deposit_refundable ? 'refundable' : 'non-refundable'}</strong>.
          {details.expires_at && (
            <>
              {' '}
              Your hold expires{' '}
              {new Date(details.expires_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}{' '}
              ({relativeExpiry(details.expires_at)}).
            </>
          )}
        </div>
      </div>

      {/* Payment method */}
      <div className="mt-6">
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setMethod('card')}
            className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
              method === 'card'
                ? 'border-[#6E0114] bg-[#6E0114] text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Credit Card
          </button>
          <button
            type="button"
            onClick={() => setMethod('paypal')}
            className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
              method === 'paypal'
                ? 'border-[#6E0114] bg-[#6E0114] text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            PayPal
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {method === 'card' ? (
          <Button className="w-full py-6 text-lg" onClick={handleStripe} disabled={paying}>
            {paying && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            Pay {formatCurrency(details.deposit_amount, details.currency)} deposit
          </Button>
        ) : (
          <DepositPayPalButtons
            reservationId={reservationId}
            currency={details.currency}
            onError={setError}
            onSuccess={() => {
              refreshPendingCart();
              router.push(`/deposit/${reservationId}/success`);
            }}
          />
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`flex justify-between ${muted ? 'text-gray-500' : 'text-gray-700'}`}>
      <span>{label}</span>
      <span className={`tabular-nums ${strong ? 'font-semibold text-gray-900' : ''}`}>{value}</span>
    </div>
  );
}

function DepositPayPalButtons({
  reservationId,
  currency,
  onSuccess,
  onError,
}: {
  reservationId: string;
  currency: string;
  onSuccess: () => void;
  onError: (message: string) => void;
}) {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  if (!clientId) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
        PayPal is not configured.
      </div>
    );
  }

  return (
    <PayPalScriptProvider options={{ clientId, currency }}>
      <PayPalButtons
        style={{ layout: 'vertical' }}
        createOrder={async () => {
          const { orderId } = await createDepositPayPalOrder(reservationId);
          return orderId;
        }}
        onApprove={async (data) => {
          try {
            await captureDepositPayPalOrder(reservationId, data.orderID);
            onSuccess();
          } catch (err) {
            onError(
              err && typeof err === 'object' && 'message' in err
                ? String((err as { message: unknown }).message)
                : 'Could not capture the PayPal payment.'
            );
          }
        }}
        onError={() => onError('PayPal reported an error. Please try again.')}
      />
    </PayPalScriptProvider>
  );
}
