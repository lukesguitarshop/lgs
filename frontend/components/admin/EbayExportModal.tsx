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
  buildDraftCsv,
  deriveEbayRow,
  ebayNetPayout,
  EBAY_CONDITIONS,
  EBAY_FEES,
  MAX_EBAY_TITLE,
  type EbayRow,
} from '@/lib/ebay/draft';
import { EBAY_CATEGORIES, GUITARS_AND_BASSES_IDS } from '@/lib/ebay/categories';
import type { ExportListing } from '@/lib/sweetwater/derive';

interface EbayExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listings: ExportListing[];
}

const currency = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function EbayExportModal({ open, onOpenChange, listings }: EbayExportModalProps) {
  const selectionKey = listings.map(l => l.id).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const derived = useMemo(() => listings.map(deriveEbayRow), [selectionKey]);
  const [edits, setEdits] = useState<Record<string, Partial<EbayRow>>>({});

  const rows = useMemo(() => derived.map(row => ({ ...row, ...edits[row.id] })), [derived, edits]);

  const update = (id: string, patch: Partial<EbayRow>) =>
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const reviewCount = rows.filter(r => r.needsReview).length;
  const totalPrice = rows.reduce((sum, r) => sum + r.price, 0);
  const totalPayout = rows.reduce((sum, r) => sum + ebayNetPayout(r.price, r.categoryId), 0);

  const handleDownload = () => {
    const blob = new Blob([buildDraftCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ebay_draft_listings_${rows.length}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1200px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>eBay draft listings export</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-4 text-sm border-b pb-3">
          <span className="font-medium">{rows.length} listings</span>
          {reviewCount > 0 && (
            <span className="flex items-center gap-1.5 text-amber-700">
              <AlertCircle className="h-4 w-4" />
              {reviewCount} need a look
            </span>
          )}
          <span className="ml-auto text-gray-500">
            Guitars &amp; Basses {EBAY_FEES.guitarsAndBassesPercent}% &middot; everything else{' '}
            {EBAY_FEES.standardPercent}% &middot; +${EBAY_FEES.perOrderFee.toFixed(2)}/order
          </span>
        </div>

        <div className="overflow-auto flex-1 -mx-6 px-6">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b text-left text-gray-600">
                <th className="py-2 pr-2 font-medium">Title (80 char limit)</th>
                <th className="py-2 px-2 font-medium">Category</th>
                <th className="py-2 px-2 font-medium">Condition</th>
                <th className="py-2 px-2 font-medium text-right">Price</th>
                <th className="py-2 pl-2 font-medium text-right">Net payout</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const reduced = GUITARS_AND_BASSES_IDS.has(row.categoryId);
                return (
                  <tr key={row.id} className="border-b align-top">
                    <td className="py-2 pr-2">
                      <div className="flex items-start gap-1.5">
                        {row.needsReview && (
                          <span
                            className="mt-2 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0"
                            title="Category was a fallback, or the title was truncated"
                          />
                        )}
                        <div className="flex-1">
                          <input
                            value={row.title}
                            maxLength={MAX_EBAY_TITLE}
                            onChange={e => update(row.id, { title: e.target.value })}
                            className="border border-gray-300 rounded px-1 py-1 bg-white w-full"
                          />
                          <span
                            className={
                              row.title.length >= MAX_EBAY_TITLE ? 'text-amber-700' : 'text-gray-400'
                            }
                          >
                            {row.title.length}/{MAX_EBAY_TITLE}
                          </span>
                          <span className="text-gray-400"> &middot; {row.images.length} photos</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <select
                        value={row.categoryId}
                        onChange={e => update(row.id, { categoryId: e.target.value })}
                        className="border border-gray-300 rounded px-1 py-1 bg-white w-48"
                      >
                        {EBAY_CATEGORIES.map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                      <span className={reduced ? 'text-green-700' : 'text-gray-400'}>
                        {reduced ? `${EBAY_FEES.guitarsAndBassesPercent}%` : `${EBAY_FEES.standardPercent}%`}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <select
                        value={row.conditionId}
                        onChange={e => update(row.id, { conditionId: e.target.value })}
                        className="border border-gray-300 rounded px-1 py-1 bg-white w-44"
                      >
                        {EBAY_CONDITIONS.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">{currency(row.price)}</td>
                    <td className="py-2 pl-2 text-right tabular-nums text-gray-600">
                      {currency(ebayNetPayout(row.price, row.categoryId))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-medium">
                <td className="py-2 pr-2" colSpan={3}>Total</td>
                <td className="py-2 px-2 text-right tabular-nums">{currency(totalPrice)}</td>
                <td className="py-2 pl-2 text-right tabular-nums">{currency(totalPayout)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="text-xs text-gray-500 border-t pt-3">
          Uploads as drafts &mdash; finish them at ebay.com/sh/lst/drafts, where you add the
          category-specific item specifics. Descriptions keep their HTML and carry the shop return
          policy.
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
