'use client';

import { useState, useEffect, use } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { Button } from '@/components/ui/button';
import { StateBlock } from '@/components/ui/state-block';
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
import { cn } from '@/lib/utils';

type DepositMethod = 'card' | 'paypal';

/** The phone payment rows. Labels match the desktop toggle; the second line is only what happens next. */
const PAYMENT_OPTIONS: { value: DepositMethod; label: string; description: string }[] = [
  { value: 'card', label: 'Credit Card', description: 'Visa, Mastercard, Amex — powered by Stripe' },
  { value: 'paypal', label: 'PayPal', description: 'Redirects to PayPal' },
];

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
  const [method, setMethod] = useState<DepositMethod>('card');

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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md py-8 text-center md:px-4 md:py-16">
        <Lock className="mx-auto h-8 w-8 text-foreground/40" />
        <h1 className="mobile-h1 mt-3 text-xl font-semibold">Sign in to pay your deposit</h1>
        <Button className="mt-4 w-full md:w-auto" onClick={() => setShowLoginModal(true)}>
          Sign in
        </Button>
      </div>
    );
  }

  if (error && !details) {
    return (
      <div className="mx-auto max-w-md py-8 text-center md:px-4 md:py-16">
        <AlertTriangle className="mx-auto h-8 w-8 text-primary" />
        <h1 className="mobile-h1 mt-3 text-xl font-semibold">We couldn&apos;t load this deposit</h1>
        <StateBlock variant="error" className="mt-4 text-left">
          {error}
        </StateBlock>
        <Link
          href="/"
          className="mt-4 inline-flex min-h-11 items-center text-primary underline md:inline-block md:min-h-0"
        >
          Back to the shop
        </Link>
      </div>
    );
  }

  if (!details) return null;

  return (
    <div className="mx-auto max-w-2xl md:px-4 md:py-8">
      <Link
        href={`/listing/${details.listing_id}`}
        className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm text-foreground/60 hover:text-foreground md:min-h-0"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to the listing
      </Link>

      <h1 className="mobile-h1 font-nav text-2xl text-foreground">Pay your deposit</h1>
      <p className="mt-2 text-base leading-[1.5] text-foreground/78 md:mt-1 md:text-sm md:text-foreground/60">
        This secures the guitar for you. You&apos;ll pay the balance when you&apos;re ready to
        complete the purchase.
      </p>

      {cancelled && (
        <StateBlock variant="warning" className="mt-4">
          That payment was cancelled. Your hold is still in place — you can try again below.
        </StateBlock>
      )}

      {/* Line item */}
      <div className="mt-6 border border-foreground/20 bg-background p-4">
        <div className="flex gap-3">
          {details.listing_image ? (
            <Image
              src={details.listing_image}
              alt=""
              width={80}
              height={80}
              className="photo-panel aspect-[4/5] w-20 shrink-0 object-cover md:aspect-auto md:h-20"
            />
          ) : (
            <div className="photo-panel aspect-[4/5] w-20 shrink-0 md:aspect-auto md:h-20" />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-foreground md:text-base md:font-medium">
              {details.line_item_label}
            </div>
            <div className="mt-0.5 text-sm text-foreground/55">
              Guitar price {formatCurrency(details.agreed_price, details.currency)}
            </div>
          </div>
          <div className="shrink-0 text-right text-[15px] font-semibold tabular-nums md:text-base">
            {formatCurrency(details.deposit_amount, details.currency)}
          </div>
        </div>

        <div className="mt-4 space-y-1.5 border-t border-foreground/10 pt-3 text-[15px] md:space-y-1 md:text-sm">
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

        <div className="mt-3 border border-foreground/20 px-3 py-2 text-[13px] leading-[1.5] text-foreground/65 md:text-xs md:leading-normal">
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
        {/* Phones get the handoff's radio rows; desktop keeps its two-button toggle. Both
            drive the same state, and the radios have their own name so the sr-only inputs
            never uncheck anything elsewhere in the document. */}
        <div className="mb-3 md:hidden">
          <p className="label-mono mb-3 text-primary">Payment</p>
          <div className="grid gap-2">
            {PAYMENT_OPTIONS.map((option) => {
              const selected = method === option.value;
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
                    name="depositMethodPhone"
                    value={option.value}
                    checked={selected}
                    onChange={() => setMethod(option.value)}
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
                    <span className="block text-base font-semibold leading-[1.2] text-foreground">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-[1.3] text-foreground/60">
                      {option.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="mb-3 hidden gap-2 md:flex">
          <button
            type="button"
            onClick={() => setMethod('card')}
            className={`flex-1 border px-3 py-2 text-sm transition-colors ${
              method === 'card'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-foreground/30 bg-background text-foreground/78 hover:bg-foreground/5'
            }`}
          >
            Credit Card
          </button>
          <button
            type="button"
            onClick={() => setMethod('paypal')}
            className={`flex-1 border px-3 py-2 text-sm transition-colors ${
              method === 'paypal'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-foreground/30 bg-background text-foreground/78 hover:bg-foreground/5'
            }`}
          >
            PayPal
          </button>
        </div>

        {error && (
          <StateBlock variant="error" className="mb-3">
            {error}
          </StateBlock>
        )}

        {method === 'card' ? (
          <Button className="w-full md:py-6 md:text-lg" onClick={handleStripe} disabled={paying}>
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
    <div className={`flex justify-between ${muted ? 'text-foreground/55' : 'text-foreground/78'}`}>
      <span>{label}</span>
      <span className={`tabular-nums ${strong ? 'font-semibold text-foreground' : ''}`}>{value}</span>
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
    return <StateBlock variant="error">PayPal is not configured.</StateBlock>;
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
