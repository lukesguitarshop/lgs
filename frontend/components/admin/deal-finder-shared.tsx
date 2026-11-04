'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

// Pieces the Reverb and Sweetwater deal finder tabs share, so the two stay identical.

export const formatPrice = (price: number, currency: string = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);

export const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

/** "just now", "12m ago", "3h ago", then a plain date - scanning a list wants relative times. */
export const timeAgo = (dateString: string) => {
  const minutes = Math.round((Date.now() - new Date(dateString).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const inputClass =
  'h-10 w-full border border-foreground/20 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-foreground focus-visible:outline-none';
export const selectClass =
  'h-10 cursor-pointer border border-foreground/20 bg-background px-2.5 text-sm text-foreground focus-visible:border-foreground focus-visible:outline-none';
export const ghostBtn =
  'font-btn inline-flex h-9 cursor-pointer items-center gap-1.5 border border-foreground/20 bg-background px-3 text-[11px] text-foreground transition-colors hover:border-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none';

export function StatCell({ value, label, onClick, active, accent, small }: {
  value: number | string;
  label: string;
  onClick?: () => void;
  active?: boolean;
  accent?: boolean;
  small?: boolean;
}) {
  const body = (
    <>
      <span className={`font-heading block leading-none tabular-nums ${small ? 'text-[22px] sm:text-[26px]' : 'text-[30px] sm:text-[36px]'} ${accent && Number(value) > 0 ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </span>
      <span className="label-mono-sm mt-2 block text-muted-foreground">{label}</span>
    </>
  );
  const cls = `relative flex min-h-[92px] flex-col justify-end border-foreground/15 px-4 py-3.5 text-left sm:px-6 [&:nth-child(odd)]:border-r sm:[&:not(:last-child)]:border-r [&:nth-child(-n+2)]:border-b sm:[&:nth-child(-n+2)]:border-b-0`;
  if (!onClick) return <div className={cls}>{body}</div>;
  return (
    <button
      onClick={onClick}
      className={`${cls} cursor-pointer transition-colors hover:bg-foreground/[0.03] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring`}
    >
      {active && <span className="absolute inset-x-0 top-0 h-[3px] bg-primary" aria-hidden />}
      {body}
    </button>
  );
}

export function ViewTabs<T extends string>({ tabs, active, onSelect }: {
  tabs: ReadonlyArray<{ value: T; label: string; count?: number }>;
  active: T;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="flex gap-6 overflow-x-auto border-b border-foreground/15" role="tablist">
      {tabs.map(t => {
        const isActive = t.value === active;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(t.value)}
            className={`font-btn -mb-px flex h-12 flex-shrink-0 cursor-pointer items-center gap-2 border-b-[3px] text-[12px] whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
              isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {t.count != null && (
              <span className={`px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${isActive ? 'bg-primary text-primary-foreground' : 'bg-foreground/8 text-foreground/70'}`}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="space-y-3 pt-4" aria-busy>
      {[0, 1, 2].map(i => (
        <div key={i} className="flex gap-4 border border-foreground/10 p-3">
          <div className="photo-panel h-28 w-24 flex-shrink-0 animate-pulse sm:h-32 sm:w-32" />
          <div className="flex-1 space-y-2.5 pt-1">
            <div className="h-4 w-3/4 animate-pulse bg-foreground/8" />
            <div className="h-7 w-28 animate-pulse bg-foreground/8" />
            <div className="h-3 w-1/2 animate-pulse bg-foreground/8" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageNav({ currentPage, totalPages, loading, onPage }: {
  currentPage: number;
  totalPages: number;
  loading: boolean;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-6 flex flex-wrap items-center justify-center gap-1.5 border-t border-foreground/10 pt-5" aria-label="Pages">
      <button onClick={() => onPage(currentPage - 1)} disabled={currentPage <= 1 || loading} className={ghostBtn}>
        <ChevronLeft className="h-3.5 w-3.5" />
        Prev
      </button>
      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
        let pageNum: number;
        if (totalPages <= 5) pageNum = i + 1;
        else if (currentPage <= 3) pageNum = i + 1;
        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
        else pageNum = currentPage - 2 + i;
        const current = pageNum === currentPage;
        return (
          <button
            key={pageNum}
            onClick={() => onPage(pageNum)}
            disabled={loading}
            aria-current={current ? 'page' : undefined}
            className={`h-9 w-9 cursor-pointer font-mono text-xs tabular-nums transition-colors ${current ? 'bg-foreground text-background' : 'border border-foreground/20 hover:border-foreground'}`}
          >
            {pageNum}
          </button>
        );
      })}
      <button onClick={() => onPage(currentPage + 1)} disabled={currentPage >= totalPages || loading} className={ghostBtn}>
        Next
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </nav>
  );
}
