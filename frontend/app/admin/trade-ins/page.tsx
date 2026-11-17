'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
import type { AdminTradeInListItem, TradeInStatus, TradeInCondition } from '@/lib/types/trade-in';
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/responsive-table';

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

const DAY_MS = 24 * 60 * 60 * 1000;

function ageLabel(createdAt: string) {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / DAY_MS);
  if (days <= 0) return 'today';
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

/** A submitted request nobody has answered in 48 hours; the customer was told 24. */
function waitingDays(it: AdminTradeInListItem) {
  if (it.status !== 'submitted') return 0;
  const days = (Date.now() - new Date(it.createdAt).getTime()) / DAY_MS;
  return days >= 2 ? Math.floor(days) : 0;
}

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

  const columns: ResponsiveColumn<AdminTradeInListItem>[] = [
    {
      id: 'email',
      header: 'Customer',
      priority: 'key',
      wide: true,
      cellClassName: 'text-sm',
      cell: (it) => (
        <Link href={`/admin/user/${it.userId}`} className="group block max-md:inline-flex max-md:min-h-11 max-md:flex-col max-md:justify-center" title="Open customer account">
          {it.fullName && <span className="block font-medium text-[#020E1C] group-hover:text-[#6E0114] group-hover:underline">{it.fullName}</span>}
          <span className={`block break-all group-hover:text-[#6E0114] group-hover:underline ${it.fullName ? 'text-xs text-gray-500' : ''}`}>{it.email}</span>
        </Link>
      ),
    },
    {
      id: 'guitar',
      header: 'Guitar',
      priority: 'primary',
      cellClassName: 'text-sm font-medium',
      cell: (it) => (
        <div className="flex items-center gap-3">
          <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded bg-gray-100">
            {it.thumbnailUrl && (
              <Image src={it.thumbnailUrl} alt="" fill sizes="44px" className="object-cover" />
            )}
          </div>
          <div className="min-w-0">
            <div>{it.brand} {it.model}</div>
            {it.photoCount === 0 ? (
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-red-100 text-red-800">No photos</span>
            ) : (
              <span className="text-xs font-normal text-gray-500">{it.condition} · {it.photoCount} photo{it.photoCount === 1 ? '' : 's'}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      priority: 'badge',
      cell: (it) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusColors[it.status] || 'bg-gray-100'}`}>{it.status}</span>
          {waitingDays(it) > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-[#6E0114] text-[#FFFFF3]">Waiting {waitingDays(it)}d</span>
          )}
        </span>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      priority: 'key',
      cellClassName: 'text-sm text-gray-600',
      cell: (it) => (
        <span title={new Date(it.createdAt).toLocaleString()}>
          {new Date(it.createdAt).toLocaleDateString()} · {ageLabel(it.createdAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      priority: 'actions',
      headerClassName: 'text-right',
      cell: (it) => (
        <div className="flex items-center justify-end gap-1 max-md:w-full max-md:justify-start">
          <button
            onClick={() => openEdit(it.id)}
            disabled={busyId === it.id}
            className="p-1.5 text-gray-500 hover:text-[#6E0114] hover:bg-[#6E0114]/10 rounded transition-colors disabled:opacity-50 max-md:flex max-md:items-center max-md:justify-center"
            aria-label="Edit"
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDelete(it)}
            disabled={busyId === it.id}
            className="p-1.5 text-gray-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50 max-md:flex max-md:items-center max-md:justify-center"
            aria-label="Delete"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <Link
            href={`/admin/trade-ins/${it.id}`}
            className="ml-1 inline-flex items-center text-[#6E0114] hover:underline text-sm max-md:ml-auto max-md:px-3"
          >
            Open <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto">
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
        <ResponsiveTable
          label="Trade-ins"
          columns={columns}
          rows={items}
          rowKey={(it) => it.id}
          rowClassName={() => 'border-b border-gray-100 last:border-0 hover:bg-black/[0.02]'}
          containerClassName="bg-[#FFFFF3] rounded-lg border border-gray-200"
          tableClassName="w-full"
          theadClassName="bg-[#FFFFF3] border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-600"
          thClassName="px-4 py-3"
          tdClassName="px-4 py-3"
        />
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
                <input value={editBrand} onChange={e => setEditBrand(e.target.value)} maxLength={100} className="w-full border border-gray-300 rounded px-3 py-2 bg-[#FFFFF3]" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Model</label>
                <input value={editModel} onChange={e => setEditModel(e.target.value)} maxLength={100} className="w-full border border-gray-300 rounded px-3 py-2 bg-[#FFFFF3]" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Condition</label>
                <select value={editCondition} onChange={e => setEditCondition(e.target.value as TradeInCondition)} className="w-full border border-gray-300 rounded px-3 py-2 bg-[#FFFFF3]">
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs text-gray-600 mb-1">Notes</label>
                  <span className="text-xs text-gray-500">{editNotes.length}/1000</span>
                </div>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} maxLength={1000} className="w-full border border-gray-300 rounded px-3 py-2 bg-[#FFFFF3]" />
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
