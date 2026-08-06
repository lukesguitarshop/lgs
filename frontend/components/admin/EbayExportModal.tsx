'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { FileSpreadsheet, AlertCircle } from 'lucide-react';
import {
  LISTING_DEFAULTS,
  MAX_EBAY_TITLE,
  buildListingCsv,
  deriveListingRow,
  type EbayListingRow,
  type ListingAction,
} from '@/lib/ebay/listing';
import { CATEGORY_ASPECTS, EBAY_BRANDS } from '@/lib/ebay/template';
import { EBAY_CATEGORIES, GUITARS_AND_BASSES_IDS } from '@/lib/ebay/categories';
import { EBAY_FEES, ebayNetPayout } from '@/lib/ebay/fees';
import type { ExportListing } from '@/lib/sweetwater/derive';

interface EbayExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listings: ExportListing[];
}

const CONDITION_LABELS: Record<string, string> = {
  '1000': 'New',
  '3000': 'Used',
  '7000': 'For parts',
};

/** Carrier codes eBay accepts for a flat-rate domestic service. */
const SHIPPING_SERVICES = ['UPSGround', 'FedExHomeDelivery', 'USPSPriority', 'USPSParcel', 'Other'];

const currency = (v: number) =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/**
 * Categories the downloaded template covers come with their required aspects.
 * The rest (accessories, parts) are still selectable -- eBay rejects an
 * accessory listed under an instrument -- but only Brand gets auto-filled.
 */
const CATEGORY_OPTIONS = EBAY_CATEGORIES.map(c => ({
  ...c,
  label: CATEGORY_ASPECTS[c.id] ? c.label : `${c.label} (specifics not mapped)`,
}));

export function EbayExportModal({ open, onOpenChange, listings }: EbayExportModalProps) {
  const selectionKey = listings.map(l => l.id).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const derived = useMemo(() => listings.map(deriveListingRow), [selectionKey]);
  const [edits, setEdits] = useState<Record<string, Partial<EbayListingRow>>>({});
  const [action, setAction] = useState<ListingAction>(LISTING_DEFAULTS.action);
  const [shippingService, setShippingService] = useState<string>(LISTING_DEFAULTS.shippingService);

  const rows = useMemo(() => derived.map(r => ({ ...r, ...edits[r.id] })), [derived, edits]);
  const update = (id: string, patch: Partial<EbayListingRow>) =>
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const reviewCount = rows.filter(r => r.needsReview).length;
  const totalPrice = rows.reduce((s, r) => s + r.price, 0);
  const totalPayout = rows.reduce((s, r) => s + ebayNetPayout(r.price, r.categoryId), 0);

  const aspectOptions = (categoryId: string, aspect: string) =>
    CATEGORY_ASPECTS[categoryId]?.values[aspect] ?? [];

  const handleDownload = () => {
    const blob = new Blob([buildListingCsv(rows, { action, shippingService })], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ebay_${action.toLowerCase()}_listings_${rows.length}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onOpenChange(false);
  };

  const cell = 'border border-gray-300 rounded px-1 py-1 bg-white';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[97vw] w-[1400px] max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>eBay bulk listing export</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-4 text-sm border-b pb-3">
          <span className="font-medium">{rows.length} listings</span>
          {reviewCount > 0 && (
            <span className="flex items-center gap-1.5 text-amber-700">
              <AlertCircle className="h-4 w-4" />
              {reviewCount} need a look
            </span>
          )}
          <label className="flex items-center gap-2">
            Upload as
            <select value={action} onChange={e => setAction(e.target.value as ListingAction)} className={cell}>
              <option value="VerifyAdd">Dry run (validate only, creates nothing)</option>
              <option value="Add">Live listings</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            Ship via
            <select value={shippingService} onChange={e => setShippingService(e.target.value)} className={cell}>
              {SHIPPING_SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <span className="ml-auto text-gray-500">Free shipping &middot; offers on &middot; no returns</span>
        </div>

        <div className="overflow-auto flex-1 -mx-6 px-6">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b text-left text-gray-600">
                {['Title', 'Category', 'Brand', 'Type', 'Body', 'Strings', 'Hand', 'Color', 'Cond', 'Price', 'Payout'].map(h => (
                  <th key={h} className="py-2 px-1 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b align-top">
                  <td className="py-2 px-1 min-w-[240px]">
                    <div className="flex items-start gap-1.5">
                      {row.needsReview && (
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" title="A field fell back to a default" />
                      )}
                      <div className="flex-1">
                        <input
                          value={row.title}
                          maxLength={MAX_EBAY_TITLE}
                          onChange={e => update(row.id, { title: e.target.value })}
                          className={`${cell} w-full`}
                        />
                        <span className={row.title.length >= MAX_EBAY_TITLE ? 'text-amber-700' : 'text-gray-400'}>
                          {row.title.length}/{MAX_EBAY_TITLE}
                        </span>
                        <span className="text-gray-400"> &middot; {row.images.length} photos</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-1">
                    <select
                      value={row.categoryId}
                      onChange={e => update(row.id, { categoryId: e.target.value })}
                      className={`${cell} w-40`}
                    >
                      {CATEGORY_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <span className={GUITARS_AND_BASSES_IDS.has(row.categoryId) ? 'text-green-700' : 'text-gray-400'}>
                      {GUITARS_AND_BASSES_IDS.has(row.categoryId)
                        ? `${EBAY_FEES.guitarsAndBassesPercent}%`
                        : `${EBAY_FEES.standardPercent}%`}
                    </span>
                  </td>
                  <td className="py-2 px-1">
                    <select value={row.brand} onChange={e => update(row.id, { brand: e.target.value })} className={`${cell} w-32`}>
                      {!EBAY_BRANDS.includes(row.brand) && <option value={row.brand}>{row.brand}</option>}
                      {EBAY_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </td>
                  <td className="py-2 px-1">
                    <select value={row.type} onChange={e => update(row.id, { type: e.target.value })} className={`${cell} w-40`}>
                      {aspectOptions(row.categoryId, 'Type').map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="py-2 px-1">
                    <select value={row.bodyType} onChange={e => update(row.id, { bodyType: e.target.value })} className={`${cell} w-32`}>
                      <option value="">&mdash;</option>
                      {aspectOptions(row.categoryId, 'Body Type').map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="py-2 px-1">
                    <select
                      value={row.stringConfiguration}
                      onChange={e => update(row.id, { stringConfiguration: e.target.value })}
                      className={`${cell} w-24`}
                    >
                      <option value="">&mdash;</option>
                      {aspectOptions(row.categoryId, 'String Configuration').map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="py-2 px-1">
                    <select value={row.handedness} onChange={e => update(row.id, { handedness: e.target.value })} className={`${cell} w-28`}>
                      <option value="">&mdash;</option>
                      {aspectOptions(row.categoryId, 'Handedness').map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="py-2 px-1">
                    <select value={row.bodyColor} onChange={e => update(row.id, { bodyColor: e.target.value })} className={`${cell} w-24`}>
                      <option value="">&mdash;</option>
                      {aspectOptions(row.categoryId, 'Body Color').map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {row.amplifierType && (
                      <select
                        value={row.amplifierType}
                        onChange={e => update(row.id, { amplifierType: e.target.value })}
                        className={`${cell} w-24 mt-1`}
                      >
                        {aspectOptions(row.categoryId, 'Amplifier Type').map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="py-2 px-1">
                    <select value={row.conditionId} onChange={e => update(row.id, { conditionId: e.target.value })} className={`${cell} w-24`}>
                      {Object.entries(CONDITION_LABELS).map(([id, label]) => (
                        <option key={id} value={id}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-1 text-right tabular-nums">{currency(row.price)}</td>
                  <td className="py-2 px-1 text-right tabular-nums text-gray-600">
                    {currency(ebayNetPayout(row.price, row.categoryId))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-medium">
                <td className="py-2 px-1" colSpan={9}>Total</td>
                <td className="py-2 px-1 text-right tabular-nums">{currency(totalPrice)}</td>
                <td className="py-2 px-1 text-right tabular-nums">{currency(totalPayout)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="text-xs text-gray-500 border-t pt-3">
          Dry run validates every row and reports errors without creating listings; switch to Live
          once it comes back clean. Payout is after eBay&apos;s final value fee &mdash;{' '}
          {EBAY_FEES.guitarsAndBassesPercent}% in Guitars
          &amp; Basses, {EBAY_FEES.standardPercent}% elsewhere &mdash; plus $
          {EBAY_FEES.perOrderFee.toFixed(2)} per order. It does not deduct what shipping costs you.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleDownload}>
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />
            Download CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
