'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowRight } from 'lucide-react';
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
      <h1 className="text-3xl font-bold text-[#020E1C] mb-6">My trade-ins</h1>
      {items.length === 0 ? (
        <p className="text-gray-600">You haven't submitted any trade-ins yet. <Link href="/trade-in" className="text-[#6E0114] underline">Start one</Link>.</p>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <Link key={item.id} href={`/trade-in/${item.id}`}
              className="flex items-center justify-between bg-[#FFFFF3] border border-gray-200 rounded-lg p-4 hover:border-[#6E0114]">
              <div>
                <h2 className="font-semibold text-[#020E1C]">{item.brand} {item.model}</h2>
                <p className="text-sm text-gray-600 capitalize">{item.status} · {new Date(item.createdAt).toLocaleDateString()}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
