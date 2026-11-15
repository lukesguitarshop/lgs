'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, ArrowRight, Plus, Guitar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getMyTradeIns } from '@/lib/api';
import type { TradeInRequestDto } from '@/lib/types/trade-in';

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Under review',
  offered: 'Offer ready',
  accepted: 'Ship your guitar',
  received: 'Received',
  inspected: 'Inspected',
  completed: 'Complete',
  declined: 'Declined',
  expired: 'Offer expired',
  cancelled: 'Cancelled',
  rejected: 'No offer',
};

export default function MyTradeInsPage() {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<TradeInRequestDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    getMyTradeIns().then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (!isAuthenticated) return <div className="text-center py-16">Sign in to view your trade-ins.</div>;
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-4">
      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="font-heading text-[clamp(30px,8vw,34px)] leading-[0.95]">My trade-ins</h1>
        <Link
          href="/trade-in/submit"
          className="font-btn inline-flex h-11 items-center gap-2 bg-primary px-4 text-[13px] text-primary-foreground transition-colors hover:bg-primary/90 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          New trade-in
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-foreground/70">You haven&apos;t submitted any trade-ins yet. <Link href="/trade-in" className="text-primary underline">Start one</Link>.</p>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const thumbUrl = item.photos[0]?.url;
            return (
              <Link key={item.id} href={`/trade-in/${item.id}`}
                className="flex items-center gap-4 border border-foreground/15 bg-background p-4 transition-colors hover:border-primary">
                <div className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden bg-muted">
                  {thumbUrl ? (
                    <Image src={thumbUrl} alt={`${item.brand} ${item.model}`} fill sizes="64px" className="object-cover" />
                  ) : (
                    <Guitar className="h-7 w-7 text-muted-foreground/60" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-foreground truncate">{item.brand} {item.model}</h2>
                  <p className={`label-mono-sm mt-1 ${item.status === 'offered' ? 'text-primary' : 'text-foreground/60'}`}>
                    {STATUS_LABELS[item.status] ?? item.status} · {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
