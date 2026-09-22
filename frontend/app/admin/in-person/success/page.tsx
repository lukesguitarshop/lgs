'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { StateBlock } from '@/components/ui/state-block';
import { formatOrderCurrency, orderNumber } from '@/lib/orders';
import { CheckCircle2, Loader2, Mail, Phone, User, Receipt, PlusCircle, ClipboardList } from 'lucide-react';

interface CompleteResponse {
  success: boolean;
  orderId: string;
  listingTitle: string | null;
  listingId: string | null;
  amount: number;
  currency: string;
  fulfillment: string;
  buyerName: string | null;
  buyerEmail: string | null;
  buyerPhone: string | null;
  needsDetails: boolean;
}

/**
 * Where Stripe sends the admin's browser after an in-person card payment. Records the
 * sale (idempotently — the webhook may already have) and shows what was captured so the
 * admin knows how much is left to fill in.
 */
function InPersonSuccessContent() {
  const searchParams = useSearchParams();
  const { isAdmin, isAuthenticated, isLoading: authLoading } = useAuth();
  const sessionId = searchParams.get('session_id');
  const [result, setResult] = useState<CompleteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A ref, not state: the request must fire exactly once even under StrictMode's
  // double-invoked effects, and nothing renders off it.
  const startedRef = useRef(false);

  useEffect(() => {
    if (authLoading || startedRef.current || !isAdmin || !sessionId) return;
    startedRef.current = true;
    (async () => {
      try {
        const data = await api.authPost<CompleteResponse>('/admin/in-person-checkout/complete', { sessionId });
        setResult(data);
      } catch (err) {
        setError(
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Could not record the sale.'
        );
      }
    })();
  }, [authLoading, isAdmin, sessionId]);

  const goToOrders = () => {
    try {
      localStorage.setItem('adminActiveTab', 'orders');
    } catch {
      // Preference only.
    }
  };

  if (authLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl md:py-16">
        <h1 className="mobile-h1 text-3xl font-bold text-[#020E1C]">Payment received</h1>
        <StateBlock variant="warning" className="mt-4">
          {isAuthenticated
            ? 'This page is for the shop admin.'
            : 'You are not signed in as the admin on this browser, so the sale could not be recorded from here.'}{' '}
          Stripe will still report the payment to the site and the order will appear in Orders on its own.
        </StateBlock>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="mx-auto max-w-xl md:py-16">
        <h1 className="mobile-h1 text-3xl font-bold text-[#020E1C]">Nothing to record</h1>
        <p className="mt-3 text-gray-600">This page needs a Stripe session to finish. Start a sale from Other Tools.</p>
        <Link href="/admin/other-tools?tab=in-person" className="mt-6 inline-flex h-12 items-center border border-foreground px-6 font-btn text-[13px]">
          Back to In-Person Sale
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl md:py-16">
        <h1 className="mobile-h1 text-3xl font-bold text-[#020E1C]">Payment received</h1>
        <StateBlock variant="error" label="Not recorded yet" className="mt-4">
          {error} If the card was charged, Stripe&apos;s webhook records the order automatically within a
          minute or two — check the Orders tab before charging again.
        </StateBlock>
        <div className="mt-6 grid gap-2 md:flex md:gap-3">
          <Link
            href="/admin"
            onClick={goToOrders}
            className="font-btn flex h-12 items-center justify-center bg-primary px-6 text-[13px] text-primary-foreground"
          >
            Open Orders
          </Link>
          <Link
            href="/admin/other-tools?tab=in-person"
            className="font-btn flex h-12 items-center justify-center border border-foreground px-6 text-[13px] text-foreground"
          >
            Back to In-Person Sale
          </Link>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
        <p className="mt-4 text-gray-600">Recording the sale…</p>
      </div>
    );
  }

  const handedOver = result.fulfillment === 'handed_over';
  const captured = [
    { icon: User, label: 'Name', value: result.buyerName },
    { icon: Mail, label: 'Email', value: result.buyerEmail },
    { icon: Phone, label: 'Phone', value: result.buyerPhone },
  ];
  const missing = captured.filter((c) => !c.value).length;

  return (
    <div className="mx-auto max-w-xl md:py-10">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-1 h-8 w-8 shrink-0 text-primary" aria-hidden />
        <div>
          <h1 className="mobile-h1 text-3xl font-bold text-[#020E1C]">Sold</h1>
          <p className="mt-1 text-gray-600">
            Order <span className="font-mono text-[#020E1C]">#{orderNumber(result.orderId)}</span>
          </p>
        </div>
      </div>

      <div className="mt-6 border border-foreground/20 px-4 py-4">
        <p className="label-mono text-primary">Charged</p>
        <p className="font-heading mt-1 text-[36px] leading-none text-[#020E1C] tabular-nums">
          {formatOrderCurrency(result.amount, result.currency)}
        </p>
        {result.listingTitle && (
          <p className="mt-3 text-[15px] leading-[1.4] text-[#020E1C]">{result.listingTitle}</p>
        )}
        <p className="mt-1 text-sm text-gray-600">
          {handedOver
            ? 'Handed over in person · recorded as delivered'
            : 'To be shipped · address collected by Stripe'}
        </p>
      </div>

      <StateBlock variant="success" label="Done" className="mt-4">
        The listing is marked sold, open offers were declined
        {result.buyerEmail ? ', and the buyer has a receipt by email.' : '.'}
      </StateBlock>

      <div className="mt-6">
        <p className="label-mono mb-2 text-primary">What Stripe captured</p>
        <ul className="divide-y divide-foreground/10 border border-foreground/15">
          {captured.map(({ icon: Icon, label, value }) => (
            <li key={label} className="flex items-center gap-3 px-4 py-3">
              <Icon className="h-4 w-4 shrink-0 text-foreground/50" />
              <span className="w-14 shrink-0 text-sm text-gray-500">{label}</span>
              <span className={value ? 'text-[15px] text-[#020E1C]' : 'text-[15px] italic text-gray-400'}>
                {value || 'not captured'}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-gray-600">
          {missing === 0
            ? 'Everything is there — open the order to confirm it and clear the flag.'
            : `${missing} thing${missing === 1 ? '' : 's'} to fill in. The order is flagged Needs details until you do.`}
        </p>
      </div>

      <div className="mt-6 grid gap-2">
        <Link
          href={`/order/${result.orderId}`}
          className="font-btn flex h-12 items-center justify-center gap-2 bg-primary px-6 text-[13px] text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <ClipboardList className="h-4 w-4" />
          Add buyer details
        </Link>
        <Link
          href="/admin/other-tools?tab=in-person"
          className="font-btn flex h-12 items-center justify-center gap-2 border border-foreground px-6 text-[13px] text-foreground transition-colors hover:bg-foreground hover:text-background"
        >
          <PlusCircle className="h-4 w-4" />
          Start another sale
        </Link>
        <Link
          href="/admin"
          onClick={goToOrders}
          className="font-btn flex h-12 items-center justify-center gap-2 border border-foreground/40 px-6 text-[13px] text-foreground/80 transition-colors hover:border-foreground"
        >
          <Receipt className="h-4 w-4" />
          All orders
        </Link>
      </div>
    </div>
  );
}

export default function InPersonSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <InPersonSuccessContent />
    </Suspense>
  );
}
