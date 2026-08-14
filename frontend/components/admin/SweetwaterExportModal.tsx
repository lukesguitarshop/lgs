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
import { buildBulkUploadCsv, ROW_DEFAULTS } from '@/lib/sweetwater/bulk-upload';
import {
  deriveRow,
  netPayout,
  subcategoriesFor,
  SWEETWATER_FEES,
  type ExportListing,
  type ExportRow,
  type PayoutMethod,
} from '@/lib/sweetwater/derive';
import { BRANDS, CONDITIONS, DECADES, TOP_CATEGORIES } from '@/lib/sweetwater/vocabulary';

interface SweetwaterExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listings: ExportListing[];
}

const currency = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function SweetwaterExportModal({ open, onOpenChange, listings }: SweetwaterExportModalProps) {
  // The parent rebuilds the array on every render, so key the memo on the
  // selection itself -- deriving scans ~1000 brand patterns per listing.
  const selectionKey = listings.map(l => l.id).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const derived = useMemo(() => listings.map(deriveRow), [selectionKey]);
  const [edits, setEdits] = useState<Record<string, Partial<ExportRow>>>({});
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>('cash');

  const rows = useMemo(
    () => derived.map(row => ({ ...row, ...edits[row.id] })),
    [derived, edits],
  );

  const update = (id: string, patch: Partial<ExportRow>) =>
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const reviewCount = rows.filter(r => r.needsReview).length;
  const totalPrice = rows.reduce((sum, r) => sum + r.price, 0);
  const totalPayout = rows.reduce((sum, r) => sum + netPayout(r.price, payoutMethod), 0);
  const feePercent = SWEETWATER_FEES.sellerFeePercent + SWEETWATER_FEES.transactionFeePercent;

  const handleDownload = () => {
    const blob = new Blob([buildBulkUploadCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sweetwater_bulk_upload_${rows.length}_listings.csv`;
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
          <DialogTitle>Sweetwater Gear Exchange export</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-4 text-sm border-b pb-3">
          <span className="font-medium">{rows.length} listings</span>
          {reviewCount > 0 && (
            <span className="flex items-center gap-1.5 text-amber-700">
              <AlertCircle className="h-4 w-4" />
              {reviewCount} need a look
            </span>
          )}
          <div className="ml-auto flex items-center gap-3">
            <label className="text-gray-600">Payout via</label>
            <select
              value={payoutMethod}
              onChange={e => setPayoutMethod(e.target.value as PayoutMethod)}
              className="border border-gray-300 rounded px-2 py-1 bg-white"
            >
              <option value="cash">Cash &mdash; {feePercent}% fees</option>
              <option value="store_credit">Store credit &mdash; no fees</option>
            </select>
          </div>
        </div>

        <div className="overflow-auto flex-1 -mx-6 px-6">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b text-left text-gray-600">
                <th className="py-2 pr-2 font-medium">Listing</th>
                <th className="py-2 px-2 font-medium">Brand</th>
                <th className="py-2 px-2 font-medium">Category</th>
                <th className="py-2 px-2 font-medium">Subcategory</th>
                <th className="py-2 px-2 font-medium">Condition</th>
                <th className="py-2 px-2 font-medium">Year</th>
                <th className="py-2 px-2 font-medium">Decade</th>
                <th className="py-2 px-2 font-medium text-right">Price</th>
                <th className="py-2 pl-2 font-medium text-right">Net payout</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b align-top">
                  <td className="py-2 pr-2 max-w-[240px]">
                    <div className="flex items-start gap-1.5">
                      {row.needsReview && (
                        <span
                          className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0"
                          title="Some fields fell back to a default"
                        />
                      )}
                      <span className="text-gray-900">{row.title}</span>
                    </div>
                    <span className="text-gray-400">{row.images.length} photos</span>
                  </td>
                  <td className="py-2 px-2">
                    <select
                      value={row.brand}
                      onChange={e => update(row.id, { brand: e.target.value })}
                      className="border border-gray-300 rounded px-1 py-1 bg-white w-32"
                    >
                      <option value="">&mdash;</option>
                      {BRANDS.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-2">
                    <select
                      value={row.topCategory}
                      onChange={e => {
                        const top = e.target.value;
                        // Old subcategory belongs to the old parent, so reset it.
                        update(row.id, { topCategory: top, subCategory: subcategoriesFor(top)[0]?.code ?? '' });
                      }}
                      className="border border-gray-300 rounded px-1 py-1 bg-white w-36"
                    >
                      {TOP_CATEGORIES.map(t => (
                        <option key={t.code} value={t.code}>{t.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-2">
                    <select
                      value={row.subCategory}
                      onChange={e => update(row.id, { subCategory: e.target.value })}
                      className="border border-gray-300 rounded px-1 py-1 bg-white w-44"
                    >
                      {subcategoriesFor(row.topCategory).map(s => (
                        <option key={s.code} value={s.code}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-2">
                    <select
                      value={row.condition}
                      onChange={e => update(row.id, { condition: e.target.value })}
                      className="border border-gray-300 rounded px-1 py-1 bg-white"
                    >
                      {CONDITIONS.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-2">
                    <input
                      value={row.year}
                      onChange={e => update(row.id, { year: e.target.value })}
                      className="border border-gray-300 rounded px-1 py-1 bg-white w-16"
                      placeholder="—"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <select
                      value={row.decade}
                      onChange={e => update(row.id, { decade: e.target.value })}
                      className="border border-gray-300 rounded px-1 py-1 bg-white w-24"
                    >
                      <option value="">&mdash;</option>
                      {DECADES.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">{currency(row.price)}</td>
                  <td className="py-2 pl-2 text-right tabular-nums text-gray-600">
                    {currency(netPayout(row.price, payoutMethod))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-medium">
                <td className="py-2 pr-2" colSpan={7}>Total</td>
                <td className="py-2 px-2 text-right tabular-nums">{currency(totalPrice)}</td>
                <td className="py-2 pl-2 text-right tabular-nums">{currency(totalPayout)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="text-xs text-gray-500 border-t pt-3">
          Every row exports as {ROW_DEFAULTS.delivery_method.toLowerCase()} with free shipping, offers
          enabled, and the shop return policy appended to the description.
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
