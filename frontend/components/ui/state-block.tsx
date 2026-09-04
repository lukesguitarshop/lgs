import * as React from 'react';

import { cn } from '@/lib/utils';

export type StateBlockVariant = 'success' | 'error' | 'warning';

interface StateBlockProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'role'> {
  variant: StateBlockVariant;
  /** The mono label. Plain words, not system-speak: "Confirmed", "Can't continue", "Heads up". */
  label?: string;
  /** Overrides the ARIA role; errors default to `alert`, everything else to `status`. */
  role?: React.AriaRole;
  children: React.ReactNode;
}

/**
 * The three state treatments from the mobile handoff (`1i`), which replace every
 * `bg-red-50` alert, green success line and yellow warning in the customer UI.
 *
 * Each one is a full-bleed fill in a palette colour — navy for success, crimson for
 * error, warm gray for warning — with a small mono label over 15px body copy. Square,
 * no tint, no fifth hue. Use it for success, error and empty states alike.
 */
const STYLES: Record<StateBlockVariant, { box: string; label: string; defaultLabel: string }> = {
  success: {
    box: 'bg-foreground text-background',
    label: 'text-muted-foreground',
    defaultLabel: 'Confirmed',
  },
  error: {
    box: 'bg-primary text-primary-foreground',
    label: 'text-primary-foreground/70',
    defaultLabel: "Can't continue",
  },
  warning: {
    box: 'bg-muted-foreground text-foreground',
    label: 'text-foreground/60',
    defaultLabel: 'Heads up',
  },
};

export function StateBlock({ variant, label, role, className, children, ...props }: StateBlockProps) {
  const style = STYLES[variant];
  return (
    <div
      role={role ?? (variant === 'error' ? 'alert' : 'status')}
      className={cn('px-4 py-3.5', style.box, className)}
      {...props}
    >
      <p className={cn('label-mono-sm tracking-[0.16em]', style.label)}>{label ?? style.defaultLabel}</p>
      <div className="mt-1.5 text-[15px] leading-[1.45] [&_a]:underline [&_a]:underline-offset-2">
        {children}
      </div>
    </div>
  );
}
