'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface AppliedDiscount {
  code: string;
  percentOff: number;
  discountAmount: number;
}

interface DiscountCodeFieldProps {
  /** Listing ids in the cart; the API prices the code against these. */
  listingIds: string[];
  applied: AppliedDiscount | null;
  onChange: (discount: AppliedDiscount | null) => void;
  /** Formats the amount taken off, in the page's own style. */
  formatAmount: (amount: number) => string;
  /** Unique per placement: the phone and desktop layouts each render one. */
  inputId: string;
  className?: string;
}

/**
 * The discount code box on checkout. Asks the API what a code is worth on this cart;
 * the API checks it again when the payment is created, so nothing here is trusted.
 */
export default function DiscountCodeField({
  listingIds,
  applied,
  onChange,
  formatAmount,
  inputId,
  className,
}: DiscountCodeFieldProps) {
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async () => {
    const typed = code.trim();
    if (!typed || checking) return;

    setChecking(true);
    setError(null);
    try {
      const quote = await api.authPost<AppliedDiscount>('/checkout/discount/quote', {
        code: typed,
        items: listingIds.map((listingId) => ({ listingId, quantity: 1 })),
      });
      onChange(quote);
      setCode('');
    } catch (err) {
      setError(err instanceof ApiError && err.status === 400 ? err.message : "Couldn't check that code. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  if (applied) {
    return (
      <div className={cn('flex items-center justify-between gap-3 text-[15px] leading-[1.4] md:text-base', className)}>
        <span className="flex min-w-0 items-center gap-2 text-foreground/65">
          <span className="truncate">
            Code <span className="label-mono text-foreground">{applied.code}</span> ({applied.percentOff}% off)
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`Remove code ${applied.code}`}
            className="-m-2 shrink-0 cursor-pointer p-2 text-foreground/50 transition-colors hover:text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </span>
        <span className="label-mono shrink-0 tabular-nums text-primary">-{formatAmount(applied.discountAmount)}</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <label htmlFor={inputId} className="sr-only">
        Discount code
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              apply();
            }
          }}
          placeholder="Discount code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={20}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className="h-12 min-w-0 flex-1 border border-foreground/35 bg-background px-3.5 text-base uppercase text-foreground placeholder:normal-case placeholder:text-foreground/45 focus:border-primary focus:outline-none md:h-10 md:rounded md:text-sm"
        />
        <button
          type="button"
          onClick={apply}
          disabled={checking || code.trim().length === 0}
          className="font-btn flex h-12 shrink-0 cursor-pointer items-center justify-center border border-foreground/35 px-4 text-[13px] text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 md:h-10 md:rounded"
        >
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
        </button>
      </div>
      {error && (
        <p id={`${inputId}-error`} role="alert" className="mt-2 text-[13px] leading-[1.4] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
