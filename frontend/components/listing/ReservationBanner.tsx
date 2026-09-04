'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StateBlock } from '@/components/ui/state-block';
import { formatCurrency, relativeExpiry, type MyReservation } from '@/lib/types/reservation';

interface ReservationBannerProps {
  reservation: MyReservation;
  onAddToCart: () => void;
  inCart: boolean;
}

/** Cream button for use on the navy success fill, where crimson would not read. */
const ON_NAVY = 'mt-3 w-full bg-background text-foreground hover:bg-background/90 md:w-auto';

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
      <StateBlock variant="warning" label="On hold for you" className="md:mb-4">
        <p className="font-semibold">This guitar is on hold for you.</p>
        <p className="mt-1">
          Pay a {formatCurrency(reservation.deposit_amount, reservation.currency)} deposit to
          lock it in.
          {expiryText && <> Hold expires {expiryText}.</>}
        </p>
        <p className="mt-1 text-[13px] leading-[1.5]">
          This deposit is{' '}
          <strong>{reservation.deposit_refundable ? 'refundable' : 'non-refundable'}</strong>.
          No shipping or tax is charged on the deposit.
        </p>
        <Button asChild className="mt-3 w-full md:w-auto">
          <Link href={`/deposit/${reservation.id}`}>
            Pay Deposit — {formatCurrency(reservation.deposit_amount, reservation.currency)}
          </Link>
        </Button>
      </StateBlock>
    );
  }

  if (depositPaid) {
    return (
      <StateBlock variant="success" label="Deposit received" className="md:mb-4">
        <p className="font-semibold">Deposit received — this guitar is yours to finish.</p>
        <p className="mt-1">
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
        {expiryText && <p className="mt-1 text-[13px] leading-[1.5]">Expires {expiryText}</p>}
        <Button asChild className={ON_NAVY}>
          <Link href="/cart">Complete Purchase</Link>
        </Button>
      </StateBlock>
    );
  }

  // No deposit required — they can just add it to the cart.
  return (
    <StateBlock variant="success" label="On hold for you" className="md:mb-4">
      <p className="font-semibold">
        {expiryText
          ? `This guitar is on hold for you until ${expiryText}.`
          : 'This guitar is on hold for you.'}
      </p>
      <p className="mt-1">
        Your price: {formatCurrency(reservation.balance_due, reservation.currency)}
        {reservation.trade_in_credit > 0 && (
          <>
            {' '}
            (includes a {formatCurrency(reservation.trade_in_credit, reservation.currency)}{' '}
            trade-in credit)
          </>
        )}
      </p>
      <Button className={ON_NAVY} onClick={onAddToCart} disabled={inCart}>
        {inCart ? 'In Cart' : 'Add to Cart'}
      </Button>
    </StateBlock>
  );
}
