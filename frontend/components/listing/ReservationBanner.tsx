'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Lock, Clock, CheckCircle2 } from 'lucide-react';
import { formatCurrency, relativeExpiry, type MyReservation } from '@/lib/types/reservation';

interface ReservationBannerProps {
  reservation: MyReservation;
  onAddToCart: () => void;
  inCart: boolean;
}

/**
 * Shown at the top of the listing page to the reserved user only.
 *
 * Three states: deposit required and unpaid, deposit paid, and no deposit required.
 * The countdown ticks live so "expires in 6 days" stays honest without a reload.
 */
export function ReservationBanner({ reservation, onAddToCart, inCart }: ReservationBannerProps) {
  const [, forceTick] = useState(0);

  // Re-render each minute so the relative countdown stays current.
  useEffect(() => {
    if (!reservation.expires_at) return;
    const timer = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(timer);
  }, [reservation.expires_at]);

  const expiryText = reservation.expires_at
    ? `${new Date(reservation.expires_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })} (${relativeExpiry(reservation.expires_at)})`
    : null;

  const depositUnpaid = reservation.deposit_required && reservation.deposit_paid_amount <= 0;
  const depositPaid = reservation.deposit_paid_amount > 0;

  if (depositUnpaid) {
    return (
      <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
        <div className="flex items-start gap-2">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div className="flex-1">
            <p className="font-semibold text-amber-900">This guitar is on hold for you.</p>
            <p className="mt-1 text-sm text-amber-800">
              Pay a {formatCurrency(reservation.deposit_amount, reservation.currency)} deposit to
              lock it in.
              {expiryText && <> Hold expires {expiryText}.</>}
            </p>
            <p className="mt-1 text-xs text-amber-700">
              This deposit is{' '}
              <strong>{reservation.deposit_refundable ? 'refundable' : 'non-refundable'}</strong>.
              No shipping or tax is charged on the deposit.
            </p>
            <Link href={`/deposit/${reservation.id}`}>
              <Button className="mt-3">
                Pay Deposit — {formatCurrency(reservation.deposit_amount, reservation.currency)}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (depositPaid) {
    return (
      <div className="mb-4 rounded-lg border border-green-300 bg-green-50 p-4">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />
          <div className="flex-1">
            <p className="font-semibold text-green-900">
              Deposit received — this guitar is yours to finish.
            </p>
            <p className="mt-1 text-sm text-green-800">
              Deposit paid: {formatCurrency(reservation.deposit_paid_amount, reservation.currency)}
              {' · '}
              Balance due: {formatCurrency(reservation.balance_due, reservation.currency)}
              {reservation.trade_in_credit > 0 && (
                <>
                  {' · '}Trade-in credit:{' '}
                  {formatCurrency(reservation.trade_in_credit, reservation.currency)}
                </>
              )}
            </p>
            {expiryText && (
              <p className="mt-1 flex items-center gap-1 text-xs text-green-700">
                <Clock className="h-3 w-3" />
                Expires {expiryText}
              </p>
            )}
            <Link href="/cart">
              <Button className="mt-3">Complete Purchase</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // No deposit required — they can just add it to the cart.
  return (
    <div className="mb-4 rounded-lg border border-blue-300 bg-blue-50 p-4">
      <div className="flex items-start gap-2">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
        <div className="flex-1">
          <p className="font-semibold text-blue-900">
            {expiryText
              ? `This guitar is on hold for you until ${expiryText}.`
              : 'This guitar is on hold for you.'}
          </p>
          <p className="mt-1 text-sm text-blue-800">
            Your price: {formatCurrency(reservation.balance_due, reservation.currency)}
            {reservation.trade_in_credit > 0 && (
              <>
                {' '}
                (includes a {formatCurrency(reservation.trade_in_credit, reservation.currency)}{' '}
                trade-in credit)
              </>
            )}
          </p>
          <Button className="mt-3" onClick={onAddToCart} disabled={inCart}>
            {inCart ? 'In Cart' : 'Add to Cart'}
          </Button>
        </div>
      </div>
    </div>
  );
}
