'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getAdminTradeIns } from '@/lib/api';
import { AdminTabsNav } from '@/components/admin/AdminTabsNav';
import type { AdminTradeInListItem, TradeInStatus } from '@/lib/types/trade-in';

const STATUS_FILTERS: (TradeInStatus | 'all')[] = ['all','submitted','offered','accepted','received','inspected','completed','declined','expired','cancelled'];

const statusColors: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-800',
  offered: 'bg-purple-100 text-purple-800',
  accepted: 'bg-green-100 text-green-800',
  received: 'bg-yellow-100 text-yellow-800',
  inspected: 'bg-orange-100 text-orange-800',
  completed: 'bg-gray-200 text-gray-800',
  declined: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-gray-100 text-gray-700',
};

export default function AdminTradeInsListPage() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<AdminTradeInListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<TradeInStatus | 'all'>('all');

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    getAdminTradeIns(status === 'all' ? undefined : status).then(setItems).finally(() => setLoading(false));
  }, [isAdmin, status]);

  if (!isAdmin) return <div className="text-center py-16">Admin access required.</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-[#020E1C] mb-2">Trade-ins</h1>
      <p className="text-gray-600 mb-6">Review submissions, send offers, manage shipping</p>
      <AdminTabsNav />
      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_FILTERS.map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-3 py-1 text-sm rounded ${status === s ? 'bg-[#6E0114] text-[#FFFFF3]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {s}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
      ) : items.length === 0 ? (
        <p className="text-gray-600">No trade-ins {status !== 'all' && `with status "${status}"`}.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Guitar</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(it => (
                <tr key={it.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{it.email}</td>
                  <td className="px-4 py-3 text-sm font-medium">{it.brand} {it.model}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded ${statusColors[it.status] || 'bg-gray-100'}`}>{it.status}</span></td>
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(it.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right"><Link href={`/admin/trade-ins/${it.id}`} className="inline-flex items-center text-[#6E0114] hover:underline text-sm">Open <ArrowRight className="h-4 w-4 ml-1" /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
