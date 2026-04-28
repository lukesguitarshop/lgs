'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, ArrowRight, Plus, Guitar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getMyTradeIns } from '@/lib/api';
import type { TradeInRequestDto } from '@/lib/types/trade-in';

export default function MyTradeInsPage() {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<TradeInRequestDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    getMyTradeIns().then(setItems).finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (!isAuthenticated) return <div className="text-center py-16">Sign in to view your trade-ins.</div>;
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="text-3xl font-bold text-[#020E1C]">My trade-ins</h1>
        <Link
          href="/trade-in/submit"
          className="inline-flex items-center gap-2 bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3] font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          New Trade-In
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-gray-600">You haven&apos;t submitted any trade-ins yet. <Link href="/trade-in" className="text-[#6E0114] underline">Start one</Link>.</p>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const thumbUrl = item.photos[0]?.url;
            return (
              <Link key={item.id} href={`/trade-in/${item.id}`}
                className="flex items-center gap-4 bg-[#FFFFF3] border border-gray-200 rounded-lg p-4 hover:border-[#6E0114] transition-colors">
                <div className="relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
                  {thumbUrl ? (
                    <Image src={thumbUrl} alt={`${item.brand} ${item.model}`} fill sizes="64px" className="object-cover" />
                  ) : (
                    <Guitar className="h-7 w-7 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-[#020E1C] truncate">{item.brand} {item.model}</h2>
                  <p className="text-sm text-gray-600 capitalize">{item.status} · {new Date(item.createdAt).toLocaleDateString()}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
