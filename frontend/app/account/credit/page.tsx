'use client';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getMyStoreCredit } from '@/lib/api';
import type { StoreCreditDto } from '@/lib/types/store-credit';

function formatPrice(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

export default function StoreCreditPage() {
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState<StoreCreditDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    getMyStoreCredit().then(setData).finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (!isAuthenticated) return <div className="text-center py-16">Sign in to view your store credit.</div>;
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-[#020E1C] mb-6">Store credit</h1>
      <div className="bg-[#FFFFF3] border-2 border-[#6E0114] rounded-lg p-8 text-center mb-8">
        <p className="text-sm text-gray-600 mb-2">Available balance</p>
        <p className="text-5xl font-bold text-[#6E0114]">{formatPrice(data?.balance || 0)}</p>
      </div>
      <h2 className="text-xl font-semibold mb-3">History</h2>
      {data && data.history.length > 0 ? (
        <div className="space-y-2">
          {data.history.map((entry, i) => (
            <div key={i} className="flex justify-between bg-[#FFFFF3] border border-gray-200 rounded p-3">
              <div>
                <p className="capitalize text-sm font-medium">{entry.reason}</p>
                <p className="text-xs text-gray-500">{new Date(entry.createdAt).toLocaleString()}</p>
              </div>
              <p className={`font-semibold ${entry.type === 'credit' ? 'text-green-700' : 'text-gray-700'}`}>
                {entry.type === 'credit' ? '+' : '-'}{formatPrice(entry.amount)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-600">No activity yet.</p>
      )}
    </div>
  );
}
