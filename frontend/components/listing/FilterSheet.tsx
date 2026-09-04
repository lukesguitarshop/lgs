'use client';

import { useMemo, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Check, X } from 'lucide-react';

import { cn } from '@/lib/utils';

/** The four filters the inventory keeps in the URL, minus sort and page. */
export interface FilterValue {
  q: string;
  conditions: string[];
  minPrice: string;
  maxPrice: string;
}

/** The fields the filters read. The API listing shape satisfies it structurally. */
export interface FilterableListing {
  listing_title: string;
  description: string | null;
  condition: string | null;
  price: number;
}

export interface PricePreset {
  label: string;
  min: string;
  max: string;
}

/**
 * Search and price only. Condition counts are taken against this set so the numbers
 * narrow with the search and price, but a checked box never zeroes out its own count.
 * Lives here rather than in SearchClient so the import runs one way — the grid needs the
 * sheet, and the sheet needs the filter, not the grid.
 */
export function filterBySearchAndPrice<T extends FilterableListing>(
  listings: T[],
  value: Pick<FilterValue, 'q' | 'minPrice' | 'maxPrice'>
): T[] {
  let result = listings;

  if (value.q) {
    const query = value.q.toLowerCase();
    result = result.filter(
      listing =>
        listing.listing_title?.toLowerCase().includes(query) ||
        listing.description?.toLowerCase().includes(query)
    );
  }

  const min = parseFloat(value.minPrice);
  const max = parseFloat(value.maxPrice);
  if (!isNaN(min)) {
    result = result.filter(listing => listing.price >= min);
  }
  if (!isNaN(max)) {
    result = result.filter(listing => listing.price <= max);
  }

  return result;
}

export function filterByCondition<T extends FilterableListing>(listings: T[], conditions: string[]): T[] {
  if (conditions.length === 0) return listings;
  return listings.filter(listing => listing.condition && conditions.includes(listing.condition));
}

export function countByCondition(listings: FilterableListing[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const listing of listings) {
    if (listing.condition) {
      counts.set(listing.condition, (counts.get(listing.condition) ?? 0) + 1);
    }
  }
  return counts;
}

/** "1 guitar" / "12 guitars" — the count reads as a sentence in the header and the apply bar. */
export function guitarCount(n: number): string {
  return `${n} ${n === 1 ? 'guitar' : 'guitars'}`;
}

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The full inventory, so the apply button can count the draft's matches live. */
  listings: FilterableListing[];
  /** The applied filters; the draft starts from these each time the sheet opens. */
  value: FilterValue;
  availableConditions: string[];
  presets: PricePreset[];
  onApply: (next: FilterValue) => void;
}

const inputClass =
  'h-12 w-full border border-foreground/35 bg-background px-3.5 text-base text-foreground outline-none placeholder:text-foreground/50 focus:border-primary';

/**
 * The filter bottom sheet from the mobile handoff (`1g`), replacing the `/filter` page.
 *
 * A navy scrim over the inventory, then a cream sheet with a 4px crimson top rule and
 * three regions: a fixed header, a scrolling body, and a fixed apply bar. The bar is a flex
 * sibling of the scroll region rather than an overlay, so it can never sit on top of the
 * filter group it applies to — that was the old page's defect.
 *
 * Edits are held in a draft and only reach the URL when "Show N guitars" is tapped, so a
 * visitor can poke at chips without the grid reshuffling under the sheet. Radix owns the
 * focus trap and returns focus to the button that opened it.
 */
export function FilterSheet({
  open,
  onOpenChange,
  listings,
  value,
  availableConditions,
  presets,
  onApply,
}: FilterSheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-foreground/55" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[min(660px,100dvh)] flex-col border-t-4 border-primary bg-background pb-[env(safe-area-inset-bottom)] focus:outline-none"
        >
          {/* Radix unmounts the content when closed, so the draft inside re-seeds from
              `value` on every open without an effect. */}
          <SheetBody
            listings={listings}
            value={value}
            availableConditions={availableConditions}
            presets={presets}
            onApply={next => {
              onApply(next);
              onOpenChange(false);
            }}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

type SheetBodyProps = Pick<FilterSheetProps, 'listings' | 'value' | 'availableConditions' | 'presets' | 'onApply'>;

const EMPTY: FilterValue = { q: '', conditions: [], minPrice: '', maxPrice: '' };

function SheetBody({ listings, value, availableConditions, presets, onApply }: SheetBodyProps) {
  const [draft, setDraft] = useState<FilterValue>(value);

  const beforeCondition = useMemo(() => filterBySearchAndPrice(listings, draft), [listings, draft]);
  const conditionCounts = useMemo(() => countByCondition(beforeCondition), [beforeCondition]);
  const liveCount = filterByCondition(beforeCondition, draft.conditions).length;

  const patch = (next: Partial<FilterValue>) => setDraft(prev => ({ ...prev, ...next }));

  const toggleCondition = (condition: string) =>
    patch({
      conditions: draft.conditions.includes(condition)
        ? draft.conditions.filter(c => c !== condition)
        : [...draft.conditions, condition],
    });

  // Tapping the active price band clears it, so a range can be undone without "Clear all".
  const togglePreset = (preset: PricePreset) => {
    const active = draft.minPrice === preset.min && draft.maxPrice === preset.max;
    patch(active ? { minPrice: '', maxPrice: '' } : { minPrice: preset.min, maxPrice: preset.max });
  };

  return (
    <>
      <div className="flex items-center justify-between border-b border-foreground/12 px-5 pt-4 pb-3">
        <DialogPrimitive.Title className="font-heading text-2xl leading-none">Filter</DialogPrimitive.Title>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDraft(EMPTY)}
            className="label-mono flex h-11 items-center px-2.5 whitespace-nowrap text-primary focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none cursor-pointer"
          >
            Clear all
          </button>
          <DialogPrimitive.Close
            aria-label="Close filters"
            className="flex h-11 w-11 items-center justify-center border-[1.5px] border-foreground text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden />
          </DialogPrimitive.Close>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-5">
        <input
          type="search"
          aria-label="Search listings"
          placeholder="Search by make, model, year"
          value={draft.q}
          onChange={e => patch({ q: e.target.value })}
          className={inputClass}
        />

        <p className="label-mono mt-7 mb-3 text-primary">Price</p>
        <div className="flex flex-wrap gap-2">
          {presets
            .filter(preset => preset.min || preset.max)
            .map(preset => {
              const active = draft.minPrice === preset.min && draft.maxPrice === preset.max;
              return (
                <button
                  key={preset.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => togglePreset(preset)}
                  className={cn(
                    'flex h-11 items-center px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none cursor-pointer',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'border-[1.5px] border-foreground/30 text-foreground'
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="Min"
            aria-label="Minimum price"
            value={draft.minPrice}
            onChange={e => patch({ minPrice: e.target.value })}
            className={inputClass}
          />
          <span className="font-mono text-sm text-muted-foreground">to</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="Max"
            aria-label="Maximum price"
            value={draft.maxPrice}
            onChange={e => patch({ maxPrice: e.target.value })}
            className={inputClass}
          />
        </div>

        {availableConditions.length > 0 && (
          <>
            <p className="label-mono mt-7 mb-1 text-primary">Condition</p>
            <div>
              {availableConditions.map(condition => {
                const checked = draft.conditions.includes(condition);
                return (
                  <label
                    key={condition}
                    className="flex h-12 cursor-pointer items-center gap-3.5 border-b border-foreground/10"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCondition(condition)}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center peer-focus-visible:ring-1 peer-focus-visible:ring-ring',
                        checked ? 'bg-primary text-primary-foreground' : 'border-[1.5px] border-foreground/40'
                      )}
                    >
                      {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                    <span className="flex-1 text-base text-foreground">{condition}</span>
                    <span className="font-mono text-[13px] text-muted-foreground">
                      {conditionCounts.get(condition) ?? 0}
                    </span>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="border-t border-foreground/12 px-5 py-3">
        <button
          type="button"
          disabled={liveCount === 0}
          onClick={() => onApply(draft)}
          className="font-btn flex h-13 w-full items-center justify-center bg-primary text-[13px] text-primary-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-primary/40 cursor-pointer"
        >
          {liveCount === 0 ? 'No matches — adjust filters' : `Show ${guitarCount(liveCount)}`}
        </button>
      </div>
    </>
  );
}
