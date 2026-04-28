'use client';
import { useEffect, useState, use } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Upload, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/toast';
import {
  getAdminTradeIn, adminCreateTradeInOffer, adminUploadTradeInLabel,
  adminMarkTradeInReceived, adminMarkTradeInInspected, adminCompleteTradeIn,
  adminMarkTradeInPaid, adminCancelTradeIn
} from '@/lib/api';
import type { AdminTradeInDetail } from '@/lib/types/trade-in';

function formatPrice(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default function AdminTradeInDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState<AdminTradeInDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cashOffer, setCashOffer] = useState('');
  const [creditOffer, setCreditOffer] = useState('');
  const [expirationDays, setExpirationDays] = useState('7');
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [paypalTxn, setPaypalTxn] = useState('');

  const reload = async () => setData(await getAdminTradeIn(id));

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    reload().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isAdmin]);

  if (!isAdmin) return <div className="text-center py-16">Admin access required.</div>;
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  if (!data) return <div className="text-center py-16">Not found.</div>;

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); await reload(); }
    catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Failed', 'error'); }
    finally { setBusy(false); }
  };

  const handleSendOffer = () => wrap(async () => {
    const c = parseFloat(cashOffer); const sc = parseFloat(creditOffer); const d = parseInt(expirationDays, 10);
    if (isNaN(c) || isNaN(sc) || isNaN(d)) { showToast('Enter valid numbers', 'error'); return; }
    await adminCreateTradeInOffer(id, c, sc, d);
    showToast('Offer sent', 'success');
    setCashOffer(''); setCreditOffer('');
  });

  const handleLabelUpload = (file: File | null) => {
    if (!file) return;
    wrap(async () => { await adminUploadTradeInLabel(id, file); showToast('Label uploaded', 'success'); });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/admin/trade-ins" className="inline-flex items-center text-gray-600 mb-4"><ArrowLeft className="h-4 w-4 mr-2" />All trade-ins</Link>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#020E1C]">{data.brand} {data.model}</h1>
          <p className="text-gray-600">{data.condition} · {data.email} · <span className="capitalize font-medium">{data.status}</span></p>
        </div>
      </div>

      {data.notes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4 text-sm">
          <strong>Notes from user:</strong> {data.notes}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {data.photos.map((p, i) => (
          <a key={i} href={p.url} target="_blank" rel="noopener" className="relative aspect-square rounded overflow-hidden bg-gray-100 block">
            <Image src={p.url} alt={`photo ${i + 1}`} fill sizes="200px" className="object-cover" />
          </a>
        ))}
      </div>

      {/* Active offer summary */}
      {data.activeOffer && (
        <div className="bg-[#FFFFF3] border border-gray-200 rounded-lg p-4 mb-4">
          <h2 className="font-semibold mb-2">Active offer</h2>
          <p>Cash: {formatPrice(data.activeOffer.cashOffer)} · Credit: {formatPrice(data.activeOffer.storeCreditOffer)} · Expires {new Date(data.activeOffer.expiresAt).toLocaleDateString()}</p>
          {data.activeOffer.acceptedType && <p className="mt-1">Accepted as <strong>{data.activeOffer.acceptedType}</strong> on {new Date(data.activeOffer.acceptedAt!).toLocaleString()}</p>}
          {data.paypalEmail && <p className="mt-1">User PayPal: <code>{data.paypalEmail}</code></p>}
          {data.activeOffer.declinedAt && <p className="mt-1 text-red-700">Declined on {new Date(data.activeOffer.declinedAt).toLocaleString()}</p>}
          {data.activeOffer.isExpired && <p className="mt-1 text-yellow-700">Offer expired without action</p>}
        </div>
      )}

      {/* Send offer form (always shown so admin can re-offer) */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-3">Send {data.allOffers.length > 0 ? 'new ' : ''}offer</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Cash $</label>
            <input type="number" step="0.01" value={cashOffer} onChange={e => setCashOffer(e.target.value)} className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Credit $</label>
            <input type="number" step="0.01" value={creditOffer} onChange={e => setCreditOffer(e.target.value)} className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Expires (days)</label>
            <input type="number" value={expirationDays} onChange={e => setExpirationDays(e.target.value)} className="w-full border rounded px-2 py-1" />
          </div>
        </div>
        <Button onClick={handleSendOffer} disabled={busy} className="mt-3 bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3]">Send offer</Button>
      </div>

      {/* Shipping section — visible after acceptance */}
      {(data.status === 'accepted' || data.status === 'received' || data.status === 'inspected' || data.status === 'completed') && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <h2 className="font-semibold mb-3">Shipping & inspection</h2>
          {data.shipping?.labelUrl ? (
            <p className="text-sm mb-2">Label: <a href={data.shipping.labelUrl} target="_blank" rel="noopener" className="text-[#6E0114] underline inline-flex items-center">View PDF <ExternalLink className="h-3 w-3 ml-1" /></a></p>
          ) : (
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm border border-dashed rounded p-3 mb-3">
              <Upload className="h-4 w-4" />Upload label PDF
              <input type="file" accept="application/pdf" className="hidden" onChange={e => handleLabelUpload(e.target.files?.[0] ?? null)} />
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            {data.status === 'accepted' && <Button onClick={() => wrap(async () => { await adminMarkTradeInReceived(id); })} disabled={busy} variant="outline">Mark Received</Button>}
            {data.status === 'received' && (
              <>
                <input type="text" value={inspectionNotes} onChange={e => setInspectionNotes(e.target.value)} placeholder="Inspection notes (optional)" className="border rounded px-2 py-1 flex-1" />
                <Button onClick={() => wrap(async () => { await adminMarkTradeInInspected(id, inspectionNotes); setInspectionNotes(''); })} disabled={busy} variant="outline">Mark Inspected</Button>
              </>
            )}
            {data.status === 'inspected' && <Button onClick={() => wrap(async () => { await adminCompleteTradeIn(id); })} disabled={busy} className="bg-green-700 text-white hover:bg-green-800">Complete</Button>}
            {data.status === 'completed' && data.activeOffer?.acceptedType === 'cash' && !data.payout?.paidAt && (
              <>
                <input type="text" value={paypalTxn} onChange={e => setPaypalTxn(e.target.value)} placeholder="PayPal txn ID" className="border rounded px-2 py-1 flex-1" />
                <Button onClick={() => wrap(async () => { await adminMarkTradeInPaid(id, paypalTxn); setPaypalTxn(''); })} disabled={busy} className="bg-green-700 text-white">Mark Paid</Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Cancel escape hatch */}
      {data.status !== 'completed' && data.status !== 'cancelled' && (
        <Button onClick={() => { if (confirm('Cancel this trade-in?')) wrap(async () => { await adminCancelTradeIn(id); }); }}
          disabled={busy} variant="outline" className="text-red-700 border-red-300">Cancel trade-in</Button>
      )}
    </div>
  );
}
