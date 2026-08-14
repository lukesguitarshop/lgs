'use client';

import { useState, useEffect, use, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { completeDepositStripe } from '@/lib/api';
import { formatCurrency } from '@/lib/types/reservation';
import { refreshPendingCart } from '@/lib/cart';

/**
 * Landing page after a deposit payment.
 *
 * For Stripe we finish the job here by settling the session. The call is idempotent
 * and the webhook is a backstop, so a failure here doesn't lose the payment.
 */
function DepositSuccessInner({ reservationId }: { reservationId: string }) {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [status, setStatus] = useState<'working' | 'done' | 'error'>('working');
  const [result, setResult] = useState<{ deposit_paid: number; balance_due: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // PayPal captures before redirecting here, so there is nothing left to settle.
    if (!sessionId) {
      setStatus('done');
      refreshPendingCart();
      return;
    }

    let active = true;
    completeDepositStripe(reservationId, sessionId)
      .then((res) => {
        if (!active) return;
        setResult({ deposit_paid: res.deposit_paid, balance_due: res.balance_due });
        setStatus('done');
        refreshPendingCart();
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'We could not confirm your deposit.'
        );
        setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [reservationId, sessionId]);

  if (status === 'working') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#6E0114]" />
        <p className="text-sm text-gray-600">Confirming your deposit…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-3 text-xl font-semibold">We couldn&apos;t confirm your deposit</h1>
        <p className="mt-2 text-sm text-gray-600">{error}</p>
        <p className="mt-2 text-sm text-gray-600">
          If your card was charged, don&apos;t pay again — get in touch and we&apos;ll sort it out.
        </p>
        <Link href="/contact" className="mt-4 inline-block text-[#6E0114] underline">
          Contact us
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
      <h1 className="mt-4 text-2xl font-semibold text-[#020E1C]">Deposit received</h1>
      <p className="mt-2 text-gray-600">
        This guitar is locked in for you. It&apos;s in your cart and can&apos;t be removed.
      </p>

      {result && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 text-left text-sm">
          <div className="flex justify-between text-gray-700">
            <span>Deposit paid</span>
            <span className="tabular-nums">{formatCurrency(result.deposit_paid)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-gray-100 pt-1 font-semibold text-gray-900">
            <span>Balance due</span>
            <span className="tabular-nums">{formatCurrency(result.balance_due)}</span>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2">
        <Link href="/cart">
          <Button className="w-full">Go to cart</Button>
        </Link>
        <Link href="/" className="text-sm text-[#6E0114] underline">
          Keep browsing
        </Link>
      </div>
    </div>
  );
}

export default function DepositSuccessPage({
  params,
}: {
  params: Promise<{ reservationId: string }>;
}) {
  const { reservationId } = use(params);

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#6E0114]" />
        </div>
      }
    >
      <DepositSuccessInner reservationId={reservationId} />
    </Suspense>
  );
}
