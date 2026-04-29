'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowRight, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  getAdminTradeIns, getAdminTradeIn, adminEditTradeIn, adminDeleteTradeIn,
} from '@/lib/api';
import { AdminTabsNav } from '@/components/admin/AdminTabsNav';
import type { AdminTradeInListItem, TradeInStatus, TradeInCondition } from '@/lib/types/trade-in';

const STATUS_FILTERS: (TradeInStatus | 'all')[] = ['all','submitted','offered','accepted','received','inspected','completed','declined','rejected','expired','cancelled'];
const CONDITIONS: TradeInCondition[] = ['Mint', 'Excellent', 'Very Good', 'Good', 'Fair'];

const statusColors: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-800',
  offered: 'bg-purple-100 text-purple-800',
  accepted: 'bg-green-100 text-green-800',
  received: 'bg-yellow-100 text-yellow-800',
  inspected: 'bg-orange-100 text-orange-800',
  completed: 'bg-gray-200 text-gray-800',
  declined: 'bg-red-100 text-red-800',
  rejected: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-gray-100 text-gray-700',
};

export default function AdminTradeInsListPage() {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<AdminTradeInListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<TradeInStatus | 'all'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Edit modal state
  const [editId, setEditId] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editBrand, setEditBrand] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editCondition, setEditCondition] = useState<TradeInCondition>('Excellent');
  const [editNotes, setEditNotes] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const data = await getAdminTradeIns(status === 'all' ? undefined : status);
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, status]);

  if (!isAdmin) return <div className="text-center py-16">Admin access required.</div>;

  const openEdit = async (id: string) => {
    setEditId(id);
    setEditLoading(true);
    try {
      const detail = await getAdminTradeIn(id);
      setEditBrand(detail.brand);
      setEditModel(detail.model);
      setEditCondition(detail.condition as TradeInCondition);
      setEditNotes(detail.notes);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to load', 'error');
      setEditId(null);
    } finally {
      setEditLoading(false);
    }
  };

  const saveEdit = async () => {
    if (!editId) return;
    if (!editBrand.trim() || !editModel.trim()) {
      showToast('Brand and model required', 'error');
      return;
    }
    setEditSaving(true);
    try {
      await adminEditTradeIn(editId, {
        brand: editBrand.trim(),
        model: editModel.trim(),
        condition: editCondition,
        notes: editNotes,
      });
      showToast('Saved', 'success');
      setEditId(null);
      await reload();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = (item: AdminTradeInListItem) => {
    if (!confirm(`Permanently delete this trade-in (${item.brand} ${item.model}) and its photos? This cannot be undone.`)) return;
    setBusyId(item.id);
    adminDeleteTradeIn(item.id)
      .then(async () => {
        showToast('Deleted', 'success');
        await reload();
      })
      .catch((e: unknown) => showToast(e instanceof Error ? e.message : 'Delete failed', 'error'))
      .finally(() => setBusyId(null));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-[#020E1C] mb-2">Trade-ins</h1>
      <p className="text-gray-600 mb-6">Review submissions, send offers, manage shipping</p>
      <AdminTabsNav />
      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_FILTERS.map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-3 py-1 text-sm rounded border transition-colors ${status === s ? 'bg-[#6E0114] text-[#FFFFF3] border-[#6E0114]' : 'bg-[#FFFFF3] text-gray-700 border-gray-300 hover:border-[#6E0114] hover:text-[#6E0114]'}`}>
            {s}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
      ) : items.length === 0 ? (
        <p className="text-gray-600">No trade-ins {status !== 'all' && `with status "${status}"`}.</p>
      ) : (
        <div className="bg-[#FFFFF3] rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#FFFFF3] border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Guitar</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(it => (
                <tr key={it.id} className="hover:bg-black/[0.02]">
                  <td className="px-4 py-3 text-sm">{it.email}</td>
                  <td className="px-4 py-3 text-sm font-medium">{it.brand} {it.model}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusColors[it.status] || 'bg-gray-100'}`}>{it.status}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(it.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(it.id)}
                        disabled={busyId === it.id}
                        className="p-1.5 text-gray-500 hover:text-[#6E0114] hover:bg-[#6E0114]/10 rounded transition-colors disabled:opacity-50"
                        aria-label="Edit"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(it)}
                        disabled={busyId === it.id}
                        className="p-1.5 text-gray-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        aria-label="Delete"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <Link
                        href={`/admin/trade-ins/${it.id}`}
                        className="ml-1 inline-flex items-center text-[#6E0114] hover:underline text-sm"
                      >
                        Open <ArrowRight className="h-4 w-4 ml-1" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit modal */}
      <Dialog open={editId !== null} onOpenChange={(open) => { if (!open && !editSaving) setEditId(null); }}>
        <DialogContent className="bg-[#FFFFF3]">
          <DialogHeader>
            <DialogTitle>Edit trade-in details</DialogTitle>
          </DialogHeader>
          {editLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Brand</label>
                <input value={editBrand} onChange={e => setEditBrand(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 bg-[#FFFFF3]" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Model</label>
                <input value={editModel} onChange={e => setEditModel(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 bg-[#FFFFF3]" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Condition</label>
                <select value={editCondition} onChange={e => setEditCondition(e.target.value as TradeInCondition)} className="w-full border border-gray-300 rounded px-3 py-2 bg-[#FFFFF3]">
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Notes</label>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} className="w-full border border-gray-300 rounded px-3 py-2 bg-[#FFFFF3]" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setEditId(null)} disabled={editSaving} variant="outline">Cancel</Button>
            <Button onClick={saveEdit} disabled={editLoading || editSaving} className="bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3]">
              {editSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
