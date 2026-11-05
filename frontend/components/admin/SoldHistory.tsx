'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Check, ChevronDown, ExternalLink, Link2, Loader2 } from 'lucide-react';
import { getProductPrice } from '@/lib/api';
import type { ProductTarget } from '@/lib/api';
import { monthlyAverages, salesWithin, unreliableLabel } from '@/lib/sold-history';
import type { MatchSource, ProductPrice, UnreliableReason } from '@/lib/types/product-price';
import { formatPrice, ghostBtn, inputClass } from './deal-finder-shared';
import { SoldListingPreview } from './SoldListingPreview';

// Sold-price line and sold-history panel shared by the Reverb and Sweetwater deal finder cards.

/** The sold-price fields both deal-finder listing types carry. */
export interface SoldPricedDeal {
  price: number;
  totalPrice?: number;
  currency: string;
  condition?: string;
  productId?: string;
  productTitle?: string;
  productUrl?: string;
  soldMedian?: number;
  soldSaleCount?: number;
  soldWindowMonths?: number;
  matchSource?: MatchSource;
  priceReliable?: boolean;
  unreliableReason?: UnreliableReason;
  priceGuideLow?: number;
  priceGuideHigh?: number;
}

const MATCH_LABELS: Record<MatchSource, string> = {
  manual: 'your fix',
  listing_link: "the listing's own product link",
  alias: 'another listing with the same model name',
  text_search: 'text search',
};

const RANGES = [
  { months: 6, label: '6 months' },
  { months: 12, label: '1 year' },
  { months: 24, label: '2 years' },
] as const;

const PAGE_SIZE = 10;

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** Headstock/neck repair found in the listing's title or description, with the sentence that says so. */
export function RepairFlag({ note }: { note?: string }) {
  if (!note) return null;
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug" title={note}>
      <span className="label-mono-sm inline-flex flex-shrink-0 items-center gap-1 bg-primary px-1.5 py-0.5 text-primary-foreground">
        <AlertTriangle className="h-3 w-3" aria-hidden />
        Headstock repair
      </span>
      <span className="line-clamp-2 italic text-foreground/70">&ldquo;{note}&rdquo;</span>
    </p>
  );
}

/** "Sold median $1,850 · 23 sales, 6 mo · Excellent", with a badge when the price isn't trusted. */
export function SoldPriceLine({ deal }: { deal: SoldPricedDeal }) {
  const reason = deal.priceReliable ? null : unreliableLabel(deal.unreliableReason);

  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-foreground/70">
      {deal.soldMedian != null ? (
        <>
          <span>
            Sold median <span className="font-medium text-foreground">{formatPrice(deal.soldMedian)}</span>
          </span>
          <span className="text-muted-foreground">
            · {deal.soldSaleCount ?? 0} {deal.soldSaleCount === 1 ? 'sale' : 'sales'}, {deal.soldWindowMonths} mo
          </span>
          {reason && (
            <span className="label-mono-sm border border-amber-700/40 bg-amber-50 px-1.5 py-0.5 text-amber-800" title="Shown for reference - never called a deal">
              {reason}
            </span>
          )}
        </>
      ) : deal.productId ? (
        <span className="text-muted-foreground">No recent sales on Reverb</span>
      ) : (
        <span className="text-muted-foreground">No product match on Reverb</span>
      )}
      {deal.priceGuideLow != null && (
        <span className="text-muted-foreground">· Used low {formatPrice(deal.priceGuideLow)}</span>
      )}
      {deal.condition && <span>· {deal.condition}</span>}
    </p>
  );
}

/**
 * "Sold history" toggle and panel: the matched product, a monthly price chart, recent
 * sales, and a field to set or fix the product by pasting a reverb.com/p/... link.
 */
export function SoldHistory({ deal, onSetProduct }: {
  deal: SoldPricedDeal;
  /** Saves a pasted product link or confirms the current match; rejects with an { message } error the panel shows. */
  onSetProduct: (target: ProductTarget) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState<ProductPrice | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState<number>(6);
  const [page, setPage] = useState(0);
  const [expandedSale, setExpandedSale] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Responses for a product the card no longer shows (after a fix) are dropped
  const currentProductId = useRef(deal.productId);

  // A new product (after a fix) means the loaded history is for the wrong guitar
  useEffect(() => {
    currentProductId.current = deal.productId;
    setProduct(null);
    setError(null);
    setLoading(false);
    setPage(0);
  }, [deal.productId]);

  useEffect(() => {
    if (!open || !deal.productId || product || loading || error) return;
    const id = deal.productId;
    setLoading(true);
    getProductPrice(id)
      .then(res => {
        if (currentProductId.current !== id) return;
        setProduct(res.product);
        setStale(res.stale);
        // Open on the window the median came from
        setMonths(res.product.windowMonths || 6);
      })
      .catch((err: { message?: string }) => {
        if (currentProductId.current === id) setError(err?.message ?? 'Failed to load sold history');
      })
      .finally(() => {
        if (currentProductId.current === id) setLoading(false);
      });
  }, [open, deal.productId, product, loading, error]);

  const handleSave = async () => {
    if (!url.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSetProduct({ url: url.trim() });
      setEditing(false);
      setUrl('');
      setOpen(true);
    } catch (err) {
      setSaveError((err as { message?: string })?.message ?? 'Failed to set product');
    } finally {
      setSaving(false);
    }
  };

  // A loose match that's actually right only needs a click to be trusted
  const canConfirm = !!deal.productId && !deal.priceReliable
    && (deal.unreliableReason === 'text_match' || deal.unreliableReason === 'broad_product');
  const [confirming, setConfirming] = useState(false);
  const handleConfirm = async () => {
    if (!deal.productId) return;
    setConfirming(true);
    setSaveError(null);
    try {
      await onSetProduct({ productId: deal.productId });
    } catch (err) {
      setSaveError((err as { message?: string })?.message ?? 'Failed to confirm the product');
    } finally {
      setConfirming(false);
    }
  };

  const delivered = deal.totalPrice ?? deal.price;
  const sales = product ? salesWithin(product.sales, months) : [];
  const pageCount = Math.max(1, Math.ceil(sales.length / PAGE_SIZE));
  const pageSales = sales.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const points = product ? monthlyAverages(product.sales, months) : [];
  const hasChartData = points.some(p => p.average != null);

  return (
    <div className="pt-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {deal.productId ? (
          <button
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            className="label-mono-sm inline-flex cursor-pointer items-center gap-1 text-foreground/80 transition-colors hover:text-foreground"
          >
            Sold history
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
          </button>
        ) : (
          <span className="label-mono-sm text-muted-foreground">No product match</span>
        )}
        {canConfirm && (
          <button
            onClick={handleConfirm}
            disabled={confirming}
            title="This match is right - trust its sold price and remember it for this model name"
            className="label-mono-sm inline-flex cursor-pointer items-center gap-1 text-emerald-800 transition-colors hover:text-emerald-950 disabled:opacity-50"
          >
            {confirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" aria-hidden />}
            Right product
          </button>
        )}
        <button
          onClick={() => { setEditing(e => !e); setSaveError(null); }}
          className="label-mono-sm inline-flex cursor-pointer items-center gap-1 text-muted-foreground transition-colors hover:text-primary"
        >
          <Link2 className="h-3.5 w-3.5" aria-hidden />
          {deal.productId ? 'Wrong product?' : 'Set product'}
        </button>
      </div>

      {saveError && !editing && <p className="mt-1 text-[13px] text-primary">{saveError}</p>}

      {editing && (
        <div className="mt-2 border border-foreground/15 p-3">
          <label className="label-mono-sm mb-1.5 block text-muted-foreground" htmlFor={`product-url-${deal.productId ?? 'none'}`}>
            Paste the Reverb product page (reverb.com/p/...) - future listings with this model name match it too
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id={`product-url-${deal.productId ?? 'none'}`}
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="https://reverb.com/p/..."
              className={inputClass}
              autoFocus
            />
            <div className="flex gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
              <button
                onClick={handleSave}
                disabled={saving || !url.trim()}
                className="font-btn inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 bg-foreground px-4 text-[11px] text-background transition-colors hover:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save
              </button>
              <button onClick={() => { setEditing(false); setSaveError(null); }} disabled={saving} className={`${ghostBtn} h-10 justify-center`}>
                Cancel
              </button>
            </div>
          </div>
          {saveError && <p className="mt-1.5 text-[13px] text-primary">{saveError}</p>}
        </div>
      )}

      {open && deal.productId && (
        <div className="mt-2 border border-foreground/15 p-3 sm:p-4">
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-[13px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading sold history...
            </div>
          ) : error ? (
            <p className="py-4 text-[13px] text-primary">{error}</p>
          ) : product ? (
            <>
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <a
                    href={product.webUrl ?? deal.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[14px] font-semibold text-foreground hover:text-primary"
                  >
                    {product.title}
                    <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                  </a>
                  {deal.matchSource && (
                    <p className="label-mono-sm mt-0.5 text-muted-foreground">Matched by {MATCH_LABELS[deal.matchSource]}</p>
                  )}
                </div>
                {product.median != null && (
                  <div className="text-right">
                    <p className="font-heading text-[22px] leading-none tabular-nums text-foreground">{formatPrice(product.median)}</p>
                    <p className="label-mono-sm mt-1 text-muted-foreground">
                      median · {product.saleCount} {product.saleCount === 1 ? 'sale' : 'sales'}, {product.windowMonths} mo
                      {product.low != null && product.high != null && product.low !== product.high && (
                        <> · {formatPrice(product.low)}-{formatPrice(product.high)}</>
                      )}
                    </p>
                  </div>
                )}
              </div>
              {stale && (
                <p className="mt-2 text-[12px] text-amber-800">Reverb couldn&apos;t be reached - showing sales from {formatDay(product.fetchedAt)}.</p>
              )}

              {/* Range */}
              <div className="mt-3 inline-flex border border-foreground/15" role="group" aria-label="Sold history range">
                {RANGES.map(r => (
                  <button
                    key={r.months}
                    onClick={() => { setMonths(r.months); setPage(0); }}
                    aria-pressed={months === r.months}
                    className={`label-mono-sm cursor-pointer px-3 py-1.5 transition-colors ${months === r.months ? 'bg-foreground text-background' : 'text-foreground/70 hover:text-foreground'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Chart */}
              {hasChartData ? (
                <div className="mt-3 h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--foreground) / 0.1)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={16} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        width={48}
                        domain={[(min: number) => Math.floor(Math.min(min, delivered) * 0.9 / 100) * 100, (max: number) => Math.ceil(Math.max(max, delivered) * 1.05 / 100) * 100]}
                        tickFormatter={(v: number) => (v < 1000 ? `$${v}` : `$${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`)}
                      />
                      <Tooltip
                        formatter={(value: number | undefined, _name, item) => [
                          value != null ? `${formatPrice(value)} (${item?.payload?.count} ${item?.payload?.count === 1 ? 'sale' : 'sales'})` : 'No sales',
                          'Avg sold',
                        ]}
                        contentStyle={{ fontSize: 12, border: '1px solid hsl(var(--foreground) / 0.15)', borderRadius: 0 }}
                      />
                      <ReferenceLine
                        y={delivered}
                        stroke="hsl(var(--primary))"
                        strokeDasharray="4 4"
                        label={{ value: `This one ${formatPrice(delivered)}`, position: 'insideBottomRight', fontSize: 11, fill: 'hsl(var(--primary))' }}
                      />
                      <Line type="monotone" dataKey="average" stroke="hsl(var(--foreground))" strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="mt-3 text-[13px] text-muted-foreground">No sales in this range.</p>
              )}

              {/* Transactions */}
              {sales.length > 0 && (
                <>
                  <table className="mt-3 w-full text-[13px]">
                    <thead>
                      <tr className="label-mono-sm border-b border-foreground/15 text-left text-muted-foreground">
                        <th className="py-1.5 font-normal">Date</th>
                        <th className="py-1.5 font-normal">Condition</th>
                        <th className="py-1.5 text-right font-normal">Sold for</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageSales.map((s, i) => {
                        const rowKey = `${s.listingId ?? i}-${s.soldAt}`;
                        const expanded = s.listingId != null && expandedSale === rowKey;
                        return (
                          <Fragment key={rowKey}>
                            <tr
                              onClick={s.listingId ? () => setExpandedSale(expanded ? null : rowKey) : undefined}
                              className={`border-b border-foreground/5 ${s.listingId ? 'cursor-pointer hover:bg-foreground/[0.03]' : ''} ${expanded ? 'bg-foreground/[0.03]' : ''}`}
                              aria-expanded={s.listingId ? expanded : undefined}
                            >
                              <td className="py-1.5 tabular-nums">{formatDay(s.soldAt)}</td>
                              <td className="py-1.5 text-foreground/80">{s.condition ?? '-'}</td>
                              <td className="py-1.5 text-right tabular-nums">
                                <span className="inline-flex items-center gap-1">
                                  <span className={s.listingId ? 'text-primary' : undefined}>{formatPrice(s.amount)}</span>
                                  {s.listingId && (
                                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
                                  )}
                                </span>
                              </td>
                            </tr>
                            {expanded && s.listingId && (
                              <tr className="border-b border-foreground/10">
                                <td colSpan={3}>
                                  <SoldListingPreview listingId={s.listingId} soldFor={s.amount} />
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                  {pageCount > 1 && (
                    <div className="mt-2 flex items-center justify-end gap-3">
                      <span className="label-mono-sm text-muted-foreground">{page + 1} / {pageCount}</span>
                      <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className={ghostBtn}>Prev</button>
                      <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1} className={ghostBtn}>Next</button>
                    </div>
                  )}
                </>
              )}
              <p className="label-mono-sm mt-2 text-muted-foreground">US sales in Good to Mint condition, from Reverb · click a sale to see the listing</p>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
