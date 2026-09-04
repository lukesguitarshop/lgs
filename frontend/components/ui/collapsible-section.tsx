import { Minus, Plus } from 'lucide-react';

import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  title: React.ReactNode;
  /** Open on first render. Specs on the listing page are; everything else starts closed. */
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  /** Classes for the panel below the row, e.g. to change its bottom padding. */
  contentClassName?: string;
}

/**
 * A native `<details>` with the handoff's 56px header row: Archivo 600 18px title, a
 * crimson `+` that becomes `−` when open, hairline rules between sections. Native
 * disclosure is keyboard- and screen-reader-accessible for free and needs no state.
 */
export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  className,
  contentClassName,
}: CollapsibleSectionProps) {
  return (
    <details className={cn('group border-t border-foreground/15', className)} open={defaultOpen}>
      <summary className="flex h-14 cursor-pointer list-none items-center justify-between gap-4 text-[18px] font-semibold leading-[1.25] text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <Plus className="h-5 w-5 shrink-0 text-primary group-open:hidden" aria-hidden />
        <Minus className="hidden h-5 w-5 shrink-0 text-primary group-open:block" aria-hidden />
      </summary>
      <div className={cn('pb-5', contentClassName)}>{children}</div>
    </details>
  );
}
