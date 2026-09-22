'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StateBlock } from '@/components/ui/state-block';
import { StickyBar } from '@/components/ui/sticky-bar';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/format';
import { formatOrderCurrency } from '@/lib/orders';
import {
  ArrowLeft,
  Check,
  CreditCard,
  Loader2,
  Lock,
  Search,
  Truck,
  Handshake,
  ChevronRight,
  X,
} from 'lucide-react';

/** The slice of the admin listings payload this tool reads. */
interface SaleListing {
  id: string;
  listing_title: string;
  condition: string | null;
  images: string[];
  price: number;
  currency: string;
  disabled: boolean;
  is_reserved: boolean;
  reservation_type_label: string | null;
  reservation_user_name: string | null;
  reservation_unassigned: boolean;
}

type Fulfillment = 'handed_over' | 'ship';

interface SessionResponse {
  sessionUrl: string;
  sessionId: string;
}

const FULFILLMENT_OPTIONS: {
  value: Fulfillment;
  label: string;
  description: string;
  icon: typeof Truck;
}[] = [
  {
    value: 'handed_over',
    label: 'Handing it over now',
    description: 'No address, no tracking. The order is recorded as delivered.',
    icon: Handshake,
  },
  {
    value: 'ship',
    label: 'Shipping it',
    description: 'The buyer types their address on the Stripe page. Free shipping, as on the site.',
    icon: Truck,
  },
];

function holdLabel(listing: SaleListing): string | null {
  if (!listing.is_reserved) return null;
  const type = listing.reservation_type_label || 'On hold';
  if (listing.reservation_unassigned) return `${type} · unassigned`;
  return listing.reservation_user_name ? `${type} for ${listing.reservation_user_name}` : type;
}

/**
 * The point-of-sale tool. Built for a phone held out to a buyer: pick the guitar from a
 * searchable list, confirm the price and whether it ships, and hand over one big
 * **Charge** button that opens the site's normal Stripe Checkout. Stripe collects the
 * buyer's card, email and phone; the admin's success page records the sale.
 *
 * Lives inside Other Tools, which owns the admin gate.
 */
export function InPersonSaleTab() {
  const searchParams = useSearchParams();
  const [listings, setListings] = useState<SaleListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<SaleListing | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [fulfillment, setFulfillment] = useState<Fulfillment>('handed_over');
  const [note, setNote] = useState('');
  const [acknowledgeHold, setAcknowledgeHold] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCancelled, setShowCancelled] = useState(searchParams.get('cancelled') === '1');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.authGet<SaleListing[]>('/admin/listings');
        if (!cancelled) setListings(data.filter((l) => !l.disabled));
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err && typeof err === 'object' && 'message' in err
              ? String((err as { message: unknown }).message)
              : 'Could not load listings.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return listings;
    return listings.filter((l) => l.listing_title.toLowerCase().includes(q));
  }, [listings, query]);

  const choose = (listing: SaleListing) => {
    setSelected(listing);
    setPriceInput(String(listing.price));
    setFulfillment('handed_over');
    setNote('');
    setAcknowledgeHold(false);
    setError(null);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearSelection = () => {
    setSelected(null);
    setError(null);
  };

  const price = Number(priceInput);
  const priceValid = Number.isFinite(price) && price > 0;
  const priceChanged = selected != null && priceValid && Math.abs(price - selected.price) >= 0.005;
  const holdBlocks = selected?.is_reserved === true && !acknowledgeHold;
  const canCharge = selected != null && priceValid && !holdBlocks && !starting;
  const currency = selected?.currency || 'USD';

  const startCheckout = async () => {
    if (!selected || !canCharge) return;
    setStarting(true);
    setError(null);
    try {
      const response = await api.authPost<SessionResponse>('/admin/in-person-checkout/session', {
        listingId: selected.id,
        price: priceChanged ? Math.round(price * 100) / 100 : null,
        fulfillment,
        acknowledgeReservation: acknowledgeHold,
        note: note.trim() || null,
      });
      window.location.href = response.sessionUrl;
    } catch (err) {
      setError(
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Could not start the checkout.'
      );
      setStarting(false);
    }
  };

  const chargeLabel = priceValid ? `Charge ${formatOrderCurrency(price, currency)}` : 'Charge';

  return (
    <div>
      <div className="mb-4">
        <h2 className="mobile-h2 text-xl font-semibold text-[#020E1C] flex items-center gap-2">
          <CreditCard className="h-5 w-5 md:inline hidden" />
          In-Person Sale
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          Ring up a guitar for someone standing in front of you. They pay by card on this
          screen through Stripe; no account needed. The listing is marked sold and the order
          waits in Orders for you to fill in who bought it.
        </p>
      </div>

      {showCancelled && (
        <StateBlock variant="warning" label="Cancelled" className="mb-4">
          <div className="flex items-start justify-between gap-3">
            <span>The Stripe checkout was cancelled. Nothing was charged and nothing was marked sold.</span>
            <button
              type="button"
              onClick={() => setShowCancelled(false)}
              className="shrink-0 p-1 -m-1"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </StateBlock>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : loadError ? (
        <StateBlock variant="error">{loadError}</StateBlock>
      ) : selected ? (
        <SaleForm
          listing={selected}
          priceInput={priceInput}
          onPriceChange={setPriceInput}
          priceValid={priceValid}
          priceChanged={priceChanged}
          fulfillment={fulfillment}
          onFulfillmentChange={setFulfillment}
          note={note}
          onNoteChange={setNote}
          acknowledgeHold={acknowledgeHold}
          onAcknowledgeHold={setAcknowledgeHold}
          error={error}
          canCharge={canCharge}
          starting={starting}
          chargeLabel={chargeLabel}
          onCharge={startCheckout}
          onBack={clearSelection}
          currency={currency}
        />
      ) : (
        <ListingPicker
          listings={filtered}
          total={listings.length}
          query={query}
          onQueryChange={setQuery}
          onChoose={choose}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

interface ListingPickerProps {
  listings: SaleListing[];
  total: number;
  query: string;
  onQueryChange: (value: string) => void;
  onChoose: (listing: SaleListing) => void;
}

function ListingPicker({ listings, total, query, onQueryChange, onChoose }: ListingPickerProps) {
  return (
    <div>
      <p className="label-mono mb-2 text-[#6E0114]">Step 1 · Pick the guitar</p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/45" />
        <Input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search active listings"
          className="pl-10"
          autoComplete="off"
        />
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {listings.length === total
          ? `${total} active listing${total === 1 ? '' : 's'}`
          : `${listings.length} of ${total} active listings`}
      </p>

      {total === 0 ? (
        <div className="py-12 text-center text-gray-500">No active listings to sell.</div>
      ) : listings.length === 0 ? (
        <div className="py-12 text-center text-gray-500">Nothing matches &ldquo;{query}&rdquo;.</div>
      ) : (
        <ul className="mt-3 divide-y divide-foreground/10 border border-foreground/15">
          {listings.map((listing) => {
            const hold = holdLabel(listing);
            return (
              <li key={listing.id}>
                <button
                  type="button"
                  onClick={() => onChoose(listing)}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-foreground/5 active:bg-foreground/10 min-h-[72px]"
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden border border-foreground/15 bg-muted">
                    {listing.images[0] ? (
                      <Image
                        src={listing.images[0]}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[15px] font-medium leading-[1.3] text-[#020E1C]">
                      {listing.listing_title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {listing.condition && (
                        <span className="label-mono-sm text-[#6E0114]">{listing.condition}</span>
                      )}
                      {hold && (
                        <span className="label-mono-sm inline-flex items-center gap-1 text-foreground/60">
                          <Lock className="h-3 w-3" />
                          {hold}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-heading text-[22px] leading-none text-[#020E1C] md:font-body md:text-base md:font-semibold">
                      {formatPrice(listing.price, listing.currency)}
                    </p>
                    <ChevronRight className="ml-auto mt-1 h-4 w-4 text-foreground/40" />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

interface SaleFormProps {
  listing: SaleListing;
  priceInput: string;
  onPriceChange: (value: string) => void;
  priceValid: boolean;
  priceChanged: boolean;
  fulfillment: Fulfillment;
  onFulfillmentChange: (value: Fulfillment) => void;
  note: string;
  onNoteChange: (value: string) => void;
  acknowledgeHold: boolean;
  onAcknowledgeHold: (value: boolean) => void;
  error: string | null;
  canCharge: boolean;
  starting: boolean;
  chargeLabel: string;
  onCharge: () => void;
  onBack: () => void;
  currency: string;
}

function SaleForm({
  listing,
  priceInput,
  onPriceChange,
  priceValid,
  priceChanged,
  fulfillment,
  onFulfillmentChange,
  note,
  onNoteChange,
  acknowledgeHold,
  onAcknowledgeHold,
  error,
  canCharge,
  starting,
  chargeLabel,
  onCharge,
  onBack,
  currency,
}: SaleFormProps) {
  const hold = holdLabel(listing);

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm text-[#6E0114] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Choose a different guitar
      </button>

      <p className="label-mono mb-2 text-[#6E0114]">Step 2 · Confirm the sale</p>

      {/* The guitar */}
      <div className="flex gap-3 border border-foreground/20 p-3">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden border border-foreground/15 bg-muted md:h-28 md:w-28">
          {listing.images[0] ? (
            <Image src={listing.images[0]} alt="" fill sizes="112px" className="object-cover" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-[1.3] text-[#020E1C] md:text-base">
            {listing.listing_title}
          </p>
          {listing.condition && (
            <p className="label-mono-sm mt-1 text-[#6E0114]">{listing.condition}</p>
          )}
          <p className="mt-2 text-sm text-gray-600">
            Listed at <span className="tabular-nums font-medium text-[#020E1C]">{formatPrice(listing.price, listing.currency)}</span>
          </p>
        </div>
      </div>

      {/* Hold warning */}
      {hold && (
        <div className="mt-4">
          <StateBlock variant="warning" label="On hold">
            <p>
              This guitar is <strong>{hold}</strong>. Selling it here does not release that hold — it
              will be flagged for you to sort out afterwards.
            </p>
          </StateBlock>
          <label className="mt-2 flex min-h-12 cursor-pointer items-center gap-3.5 border border-foreground/25 px-4 py-2.5">
            <input
              type="checkbox"
              checked={acknowledgeHold}
              onChange={(e) => onAcknowledgeHold(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center border-[1.5px] peer-focus-visible:ring-1 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
                acknowledgeHold ? 'border-primary bg-primary text-primary-foreground' : 'border-foreground/40'
              )}
            >
              {acknowledgeHold && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </span>
            <span className="text-[15px] leading-[1.3]">I know. Sell it in person anyway.</span>
          </label>
        </div>
      )}

      {/* Price */}
      <label className="label-mono mt-6 mb-2 block text-[#6E0114]" htmlFor="in-person-price">
        Agreed price ({currency})
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-foreground/60 md:text-sm">$</span>
        <Input
          id="in-person-price"
          type="number"
          inputMode="decimal"
          min="1"
          step="1"
          value={priceInput}
          onChange={(e) => onPriceChange(e.target.value)}
          className={cn('pl-8 tabular-nums text-lg font-semibold md:text-base', !priceValid && 'border-primary')}
        />
      </div>
      <p className="mt-1.5 text-xs text-gray-500">
        {!priceValid
          ? 'Enter the amount the buyer is paying.'
          : priceChanged
            ? `Different from the listed ${formatPrice(listing.price, listing.currency)} — this is what Stripe will charge.`
            : 'Change it if you agreed on something else. No tax or fees are added.'}
      </p>

      {/* Fulfillment */}
      <p className="label-mono mt-6 mb-2 text-[#6E0114]">What happens to the guitar</p>
      <div className="grid gap-2">
        {FULFILLMENT_OPTIONS.map((option) => {
          const chosen = fulfillment === option.value;
          const Icon = option.icon;
          return (
            <label
              key={option.value}
              className={cn(
                'flex min-h-14 cursor-pointer items-center gap-3.5 border-[1.5px] px-4 transition-colors',
                chosen ? 'border-primary bg-primary/6' : 'border-foreground/25'
              )}
            >
              <input
                type="radio"
                name="inPersonFulfillment"
                value={option.value}
                checked={chosen}
                onChange={() => onFulfillmentChange(option.value)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  'h-[18px] w-[18px] shrink-0 border-[1.5px] peer-focus-visible:ring-1 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
                  chosen ? 'border-primary bg-primary' : 'border-foreground/35'
                )}
              />
              <Icon className="h-5 w-5 shrink-0 text-foreground/60" />
              <span className="py-2.5">
                <span className="block text-base font-semibold leading-[1.2] text-foreground">{option.label}</span>
                <span className="mt-0.5 block text-[13px] leading-[1.3] text-foreground/60">{option.description}</span>
              </span>
            </label>
          );
        })}
      </div>

      {/* Note */}
      <label className="label-mono mt-6 mb-2 block text-[#6E0114]" htmlFor="in-person-note">
        Note for yourself <span className="normal-case tracking-normal text-foreground/50">(optional)</span>
      </label>
      <textarea
        id="in-person-note"
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        rows={2}
        maxLength={450}
        placeholder="e.g. Buyer from the Saturday show, paid with a friend's card"
        className="w-full border border-foreground/35 bg-transparent px-3.5 py-2.5 text-base placeholder:text-foreground/45 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:border-input md:px-3 md:text-sm"
      />

      {/* What will happen */}
      <div className="mt-6 border border-foreground/15 bg-foreground/[0.03] px-4 py-3 text-[13px] leading-[1.5] text-foreground/70">
        <p className="label-mono-sm mb-1.5 text-foreground/60">When the card goes through</p>
        <ul className="list-disc space-y-0.5 pl-4">
          <li>Stripe asks the buyer for their card, email and phone{fulfillment === 'ship' ? ', and shipping address' : ''}.</li>
          <li>The listing is marked sold and open offers on it are declined.</li>
          <li>The buyer gets a receipt by email; you get the usual new-order email.</li>
          <li>The order lands in Orders flagged <strong>Needs details</strong> for you to finish later.</li>
        </ul>
      </div>

      {error && (
        <StateBlock variant="error" className="mt-4">
          {error}
        </StateBlock>
      )}

      {/* Desktop action; the phone gets the sticky bar below. */}
      <div className="mt-6 hidden md:flex md:items-center md:justify-end md:gap-3">
        <Button variant="outline" onClick={onBack} disabled={starting}>
          Back
        </Button>
        <Button
          onClick={onCharge}
          disabled={!canCharge}
          className="bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3] min-w-[220px]"
        >
          {starting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Opening Stripe…
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4" />
              {chargeLabel}
            </>
          )}
        </Button>
      </div>

      <StickyBar className="grid grid-cols-[auto_1fr] gap-4">
        <div className="min-w-0">
          <p className="label-mono-sm text-foreground/60">Total</p>
          <p className="font-heading text-[24px] leading-none text-foreground tabular-nums">
            {priceValid ? formatOrderCurrency(Number(priceInput), currency) : '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={onCharge}
          disabled={!canCharge}
          className="font-btn flex h-12 w-full items-center justify-center gap-2 bg-primary text-[13px] text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {starting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Opening Stripe…
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4" />
              {chargeLabel}
            </>
          )}
        </button>
      </StickyBar>
    </div>
  );
}
