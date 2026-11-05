'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Loader2, ExternalLink, X, Check, RefreshCw, Play, Trash2, Search, MapPin, Truck, HelpCircle, Store } from 'lucide-react';
import { getSweetwaterPotentialBuys, getSweetwaterPotentialBuyStats, dismissSweetwaterPotentialBuy, dismissSweetwaterPotentialBuysBulk, dismissAllSweetwaterPotentialBuys, deleteAllSweetwaterPotentialBuys, markSweetwaterPotentialBuyPurchased, runSweetwaterDealFinder, getSweetwaterDealFinderStatus, setSweetwaterPotentialBuyProduct } from '@/lib/api';
import type { ProductTarget } from '@/lib/api';
import type { SweetwaterPotentialBuy, SweetwaterPotentialBuyStats } from '@/lib/types/sweetwater-potential-buy';
import { MedianBadge, OfferLine, RepairFlag, SoldHistory, SoldPriceLine } from './SoldHistory';
import { formatPrice, formatDate, timeAgo, inputClass, selectClass, ghostBtn, StatCell, ViewTabs, ListSkeleton, PageNav } from './deal-finder-shared';

/**
 * Sweetwater keeps seller review counts behind bot protection, so shops are told apart
 * by how many listings they have up: private sellers have a handful, shops have 100+.
 */
const SMALL_SELLER_MAX_LISTINGS = 25;

type View = 'deals' | 'priced' | 'no-price-guide';

export function SweetwaterDealFinderTab() {
  const [deals, setDeals] = useState<SweetwaterPotentialBuy[]>([]);
  const [stats, setStats] = useState<SweetwaterPotentialBuyStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('deals');
  const [sortBy, setSortBy] = useState<string>('listed-newest');
  const [searchInput, setSearchInput] = useState('');
  const [minPriceInput, setMinPriceInput] = useState('');
  const [maxPriceInput, setMaxPriceInput] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<{ search: string; minPrice?: number; maxPrice?: number }>({ search: '' });
  const [smallSellersOnly, setSmallSellersOnly] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [scraperRunning, setScraperRunning] = useState(false);
  const [scraperResult, setScraperResult] = useState<{ success: boolean; message: string } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [bulkDismissing, setBulkDismissing] = useState<'page' | 'all' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const perPage = 20;
  const view: View = statusFilter === 'no-price-guide' || statusFilter === 'priced' ? statusFilter : 'deals';
  const isPricedView = view === 'priced';
  const isNoPriceView = view === 'no-price-guide';
  // The list on screen when it's one you work through (not dismissed/purchased)
  const activeList = statusFilter === 'deals' || statusFilter === 'no-price-guide' ? statusFilter : null;
  const activeCount = activeList === 'no-price-guide' ? stats?.noPriceGuide ?? 0 : stats?.deals ?? 0;

  const fetchDeals = async (page = currentPage) => {
    setLoading(true);
    setFetchError(null);
    try {
      const [dealsData, statsData] = await Promise.all([
        getSweetwaterPotentialBuys(statusFilter, sortBy, page, perPage, appliedFilters.search || undefined, appliedFilters.minPrice, appliedFilters.maxPrice, smallSellersOnly ? SMALL_SELLER_MAX_LISTINGS : undefined),
        getSweetwaterPotentialBuyStats()
      ]);
      setDeals(dealsData.items);
      setTotalPages(dealsData.totalPages);
      setTotalItems(dealsData.total);
      setCurrentPage(dealsData.page);
      setStats(statsData);
    } catch (err) {
      const errorMessage = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message || 'Failed to load deals';
      console.error('Failed to fetch Sweetwater deals:', errorMessage);
      setFetchError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    fetchDeals(1);
  }, [statusFilter, sortBy, appliedFilters, smallSellersOnly]);

  // Debounce search/price inputs before applying them as fetch filters
  useEffect(() => {
    const timer = setTimeout(() => {
      const min = parseFloat(minPriceInput);
      const max = parseFloat(maxPriceInput);
      setAppliedFilters(prev => {
        const next = {
          search: searchInput.trim(),
          minPrice: Number.isFinite(min) ? min : undefined,
          maxPrice: Number.isFinite(max) ? max : undefined,
        };
        return prev.search === next.search && prev.minPrice === next.minPrice && prev.maxPrice === next.maxPrice
          ? prev
          : next;
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, minPriceInput, maxPriceInput]);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await getSweetwaterDealFinderStatus();
        setScraperRunning(status.isRunning);
      } catch (err) {
        console.error('Failed to check Sweetwater scraper status:', err);
      }
    };
    checkStatus();
  }, []);

  // Re-render once a minute so the "12m ago" times stay honest while the tab sits open
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  /** Keeps the tab counts right after cards leave the active list without a refetch. */
  const decrementActive = (by: number) => {
    if (!activeList) return;
    setStats(prev => {
      if (!prev) return prev;
      return activeList === 'no-price-guide'
        ? { ...prev, noPriceGuide: Math.max(0, (prev.noPriceGuide ?? 0) - by) }
        : { ...prev, deals: Math.max(0, prev.deals - by) };
    });
  };

  const handleRunScraper = async () => {
    setScraperRunning(true);
    setScraperResult(null);
    try {
      const result = await runSweetwaterDealFinder();
      setScraperResult({
        success: result.success,
        message: result.success
          ? `Found ${result.dealsFound} deals from ${result.listingsChecked} listings, ${result.withPriceData ?? 0} with price data${result.lookupErrors ? `, ${result.lookupErrors} lookup errors` : ''} (${result.duration})`
          : result.message
      });
      if (result.success) {
        await fetchDeals();
      }
    } catch (err) {
      setScraperResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to run scraper'
      });
    } finally {
      setScraperRunning(false);
    }
  };

  // Pasting a product link re-prices the card in place; it moves tabs on the next refresh
  const handleSetProduct = async (id: string, target: ProductTarget) => {
    const updated = await setSweetwaterPotentialBuyProduct(id, target);
    setDeals(prev => prev.map(d => (d.id === id ? updated : d)));
  };

  const handleDismiss = async (id: string) => {
    setActionLoading(id);
    try {
      await dismissSweetwaterPotentialBuy(id);
      setDeals(prev => prev.filter(d => d.id !== id));
      decrementActive(1);
    } catch (err) {
      console.error('Failed to dismiss:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkPurchased = async (id: string) => {
    setActionLoading(id);
    try {
      await markSweetwaterPotentialBuyPurchased(id);
      setDeals(prev => prev.filter(d => d.id !== id));
      decrementActive(1);
    } catch (err) {
      console.error('Failed to mark as purchased:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismissPage = async () => {
    if (deals.length === 0) return;
    if (!confirm(`Dismiss all ${deals.length} listings on this page?`)) return;

    setBulkDismissing('page');
    try {
      const result = await dismissSweetwaterPotentialBuysBulk(deals.map(d => d.id));
      setDeals([]);
      decrementActive(result.dismissed);
      await fetchDeals(1);
    } catch (err) {
      console.error('Failed to dismiss page:', err);
    } finally {
      setBulkDismissing(null);
    }
  };

  const handleDismissAll = async () => {
    if (!activeList || activeCount === 0) return;
    const what = activeList === 'no-price-guide' ? 'listings with no price guide' : 'active deals';
    if (!confirm(`Dismiss ALL ${activeCount} ${what}? This cannot be undone.`)) return;

    setBulkDismissing('all');
    try {
      await dismissAllSweetwaterPotentialBuys(activeList);
      setDeals([]);
      decrementActive(activeCount);
    } catch (err) {
      console.error('Failed to dismiss all:', err);
    } finally {
      setBulkDismissing(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('DELETE ALL scanned Sweetwater listings from the database? This permanently removes all data and cannot be undone.')) return;

    setDeleting(true);
    try {
      await deleteAllSweetwaterPotentialBuys();
      setDeals([]);
      setStats({ total: 0, deals: 0, noPriceGuide: 0, lastRunAt: undefined });
      setTotalItems(0);
      setTotalPages(1);
      setCurrentPage(1);
    } catch (err) {
      console.error('Failed to delete all:', err);
    } finally {
      setDeleting(false);
    }
  };

  const switchView = (next: View) => {
    if (next === view) return;
    setDeals([]); // show the loading skeleton, not the other tab's cards, until the fetch lands
    setStatusFilter(next);
    setSortBy(next === 'priced' ? 'best-deal' : 'listed-newest');
  };

  const hasFilters = !!(searchInput || minPriceInput || maxPriceInput || smallSellersOnly);

  return (
    <section className="border border-foreground/15 bg-background">
      {/* Header */}
      <div className="border-t-4 border-b border-t-primary border-b-foreground/15 px-4 pt-5 pb-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="label-mono text-primary">Deal finder · Sweetwater Gear Exchange</p>
            <h2 className="font-heading mt-1.5 text-[34px] leading-none text-foreground uppercase sm:text-[42px]">
              Sweetwater Deals
            </h2>
            <p className="mt-2 flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2" aria-hidden>
                {scraperRunning && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />}
                <span className={`relative inline-flex h-2 w-2 rounded-full ${scraperRunning ? 'bg-primary' : 'bg-emerald-600'}`} />
              </span>
              {scraperRunning
                ? 'Scanning Sweetwater now…'
                : stats?.lastRunAt ? `Live · checked ${timeAgo(stats.lastRunAt)}` : 'Not scanned yet'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => fetchDeals()} disabled={loading} className={ghostBtn} aria-label="Refresh">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleRunScraper}
              disabled={scraperRunning}
              className="font-btn inline-flex h-9 cursor-pointer items-center gap-1.5 bg-primary px-4 text-[11px] text-primary-foreground transition-colors hover:bg-[#580110] disabled:cursor-not-allowed disabled:bg-primary/50 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {scraperRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              {scraperRunning ? 'Scanning…' : 'Full scan'}
            </button>
          </div>
        </div>
      </div>

      {/* Stat band */}
      {stats && (
        <div className="grid grid-cols-2 border-b border-foreground/15 sm:grid-cols-4">
          <StatCell value={stats.deals} label="Active deals" onClick={() => switchView('deals')} active={view === 'deals'} />
          <StatCell value={stats.noPriceGuide ?? 0} label="No price guide" onClick={() => switchView('no-price-guide')} active={isNoPriceView} />
          <StatCell value={stats.total} label="Scanned" />
          <StatCell value={stats.lastRunAt ? timeAgo(stats.lastRunAt) : '—'} label="Last check" small />
        </div>
      )}

      <div className="px-4 pb-6 sm:px-6">
        {/* Tabs */}
        <ViewTabs
          tabs={[
            { value: 'deals', label: 'Deals', count: stats?.deals },
            { value: 'priced', label: 'Priced', count: stats?.priced },
            { value: 'no-price-guide', label: 'No price guide', count: stats?.noPriceGuide },
          ] as const}
          active={view}
          onSelect={switchView}
        />

        {/* Messages */}
        {scraperResult && (
          <div className={`mt-4 flex items-start justify-between gap-3 border-l-4 px-3 py-2.5 text-sm ${scraperResult.success ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-primary bg-primary/5 text-primary'}`}>
            <span>{scraperResult.message}</span>
            <button onClick={() => setScraperResult(null)} className="cursor-pointer opacity-60 hover:opacity-100" aria-label="Close message">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {fetchError && (
          <div className="mt-4 border-l-4 border-primary bg-primary/5 px-3 py-2.5 text-sm text-primary">
            <strong>Couldn&apos;t load deals:</strong> {fetchError}
          </div>
        )}

        {isNoPriceView && (
          <div className="mt-4 flex gap-3 border border-foreground/15 bg-foreground/[0.03] p-3 sm:p-4">
            <HelpCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
            <p className="text-sm text-foreground/80">
              Listings without a <strong className="text-foreground">trusted sold price</strong> on Reverb (no product match, too few sales, or a loose text match), so the deal finder can&apos;t tell whether they&apos;re a deal. Check these by hand, or use Set product to fix the match.
            </p>
          </div>
        )}

        {/* Toolbar */}
        <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search guitars…"
              className={`${inputClass} pr-9 pl-9`}
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="0"
              value={minPriceInput}
              onChange={(e) => setMinPriceInput(e.target.value)}
              placeholder="Min $"
              aria-label="Minimum delivered price"
              className={`${inputClass} sm:w-24`}
            />
            <span className="text-muted-foreground">–</span>
            <input
              type="number"
              min="0"
              value={maxPriceInput}
              onChange={(e) => setMaxPriceInput(e.target.value)}
              placeholder="Max $"
              aria-label="Maximum delivered price"
              className={`${inputClass} sm:w-24`}
            />
          </div>
          <button
            type="button"
            onClick={() => setSmallSellersOnly(v => !v)}
            aria-pressed={smallSellersOnly}
            title={`Hide guitars from sellers with more than ${SMALL_SELLER_MAX_LISTINGS} listings on Gear Exchange (shops)`}
            className={`font-btn inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 border px-3 text-[11px] whitespace-nowrap transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none ${
              smallSellersOnly ? 'border-foreground bg-foreground text-background' : 'border-foreground/20 bg-background text-foreground hover:border-foreground'
            }`}
          >
            <Store className="h-3.5 w-3.5" aria-hidden />
            ≤{SMALL_SELLER_MAX_LISTINGS} listings
          </button>
          <div className="flex items-center gap-1.5 sm:col-span-3 lg:col-span-1">
            {view === 'deals' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Status"
                className={`${selectClass} flex-1 lg:flex-none`}
              >
                <option value="deals">Active</option>
                <option value="dismissed">Dismissed</option>
                <option value="purchased">Purchased</option>
              </select>
            )}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort"
              className={`${selectClass} flex-1 lg:flex-none`}
            >
              <option value="listed-newest">Newest listed</option>
              {!isNoPriceView && <option value="best-deal">Best deal first</option>}
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
              <option value="newest">Date found: newest</option>
              <option value="oldest">Date found: oldest</option>
            </select>
          </div>
        </div>

        {/* Results bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-b border-foreground/10 pb-3">
          <p className="label-mono-sm text-muted-foreground">
            {totalItems} {totalItems === 1 ? 'guitar' : 'guitars'}
            {totalPages > 1 && ` · page ${currentPage} of ${totalPages}`}
            {hasFilters && (
              <button
                onClick={() => { setSearchInput(''); setMinPriceInput(''); setMaxPriceInput(''); setSmallSellersOnly(false); }}
                className="ml-3 cursor-pointer text-primary underline-offset-2 hover:underline"
              >
                Clear filters
              </button>
            )}
          </p>
          {activeList && deals.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => {
                  deals.filter(d => d.sweetwaterLink).forEach(d => window.open(d.sweetwaterLink!, '_blank'));
                }}
                disabled={loading}
                className={ghostBtn}
              >
                <ExternalLink className="h-3 w-3" />
                Open all ({deals.filter(d => d.sweetwaterLink).length})
              </button>
              <button onClick={handleDismissPage} disabled={bulkDismissing !== null || loading} className={ghostBtn}>
                {bulkDismissing === 'page' ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                Dismiss page
              </button>
              <button
                onClick={handleDismissAll}
                disabled={bulkDismissing !== null || loading || !activeCount}
                className={`${ghostBtn} text-primary hover:border-primary`}
              >
                {bulkDismissing === 'all' ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                Dismiss all ({activeCount})
              </button>
            </div>
          )}
        </div>

        {/* List */}
        {loading && deals.length === 0 ? (
          <ListSkeleton />
        ) : deals.length === 0 ? (
          <div className="py-14 text-center">
            <p className="font-heading text-2xl text-foreground uppercase">
              {isPricedView ? 'Nothing priced yet' : isNoPriceView ? 'Nothing without a price guide' : 'No deals right now'}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {hasFilters
                ? 'Try adjusting your search or filters.'
                : isPricedView
                  ? "Guitars with a trusted sold price that aren't deals will show up here."
                : isNoPriceView
                  ? 'Listings without a trusted sold price will show up here.'
                  : 'Gear Exchange is checked every 30 minutes. Run a full scan to sweep it now.'}
            </p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-foreground/10">
              {deals.map((deal) => (
                <SweetwaterDealRow
                  key={deal.id}
                  deal={deal}
                  busy={actionLoading === deal.id}
                  onPurchased={() => handleMarkPurchased(deal.id)}
                  onDismiss={() => handleDismiss(deal.id)}
                  onSetProduct={(target) => handleSetProduct(deal.id, target)}
                />
              ))}
            </ul>

            <PageNav currentPage={currentPage} totalPages={totalPages} loading={loading} onPage={(p) => fetchDeals(p)} />
          </>
        )}

        {/* Danger zone, out of the way */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleDeleteAll}
            disabled={deleting || loading}
            className="label-mono-sm inline-flex cursor-pointer items-center gap-1.5 text-muted-foreground transition-colors hover:text-primary disabled:opacity-50"
          >
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            Delete all scanned data
          </button>
        </div>
      </div>
    </section>
  );
}

function SweetwaterDealRow({ deal, busy, onPurchased, onDismiss, onSetProduct }: {
  deal: SweetwaterPotentialBuy;
  busy: boolean;
  onPurchased: () => void;
  onDismiss: () => void;
  onSetProduct: (target: ProductTarget) => Promise<void>;
}) {
  const total = deal.totalPrice ?? deal.price;
  // Below (positive) or above (negative) the sold median - shown for every trusted price
  const discount = deal.hasPriceGuide && deal.discountPercent != null ? deal.discountPercent : null;
  const isShop = deal.sellerListingCount != null && deal.sellerListingCount > SMALL_SELLER_MAX_LISTINGS;
  const listedLabel = deal.listingCreatedAt ? `Listed ${timeAgo(deal.listingCreatedAt)}` : `Found ${timeAgo(deal.firstSeenAt)}`;

  return (
    <li className="group py-4">
      <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-5">
        {/* Photo */}
        <a
          href={deal.sweetwaterLink ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="photo-panel relative h-32 w-24 overflow-hidden border border-foreground/15 sm:row-span-2 sm:h-40 sm:w-36"
          tabIndex={-1}
          aria-hidden
        >
          {deal.images?.[0] ? (
            <Image
              src={deal.images[0]}
              alt=""
              fill
              sizes="144px"
              unoptimized
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <span className="label-mono-sm absolute inset-0 flex items-center justify-center text-foreground/45">No photo</span>
          )}
          {discount != null ? (
            <MedianBadge percent={discount} />
          ) : deal.soldMedian == null ? (
            <span className="label-mono-sm absolute inset-x-0 bottom-0 bg-foreground px-2 py-1.5 text-center text-background">
              No price data
            </span>
          ) : null}
        </a>

        {/* Details */}
        <div className="flex min-w-0 flex-col">
          <div className="flex items-start justify-between gap-3">
            <a
              href={deal.sweetwaterLink ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="line-clamp-2 text-[15px] leading-snug font-semibold text-foreground transition-colors hover:text-primary sm:text-base"
            >
              {deal.listingTitle}
            </a>
            <span className="label-mono-sm hidden flex-shrink-0 pt-1 text-muted-foreground sm:block" title={deal.listingCreatedAt ? `Listed ${formatDate(deal.listingCreatedAt)}` : undefined}>
              {listedLabel}
            </span>
          </div>
          <span className="label-mono-sm mt-1 text-muted-foreground sm:hidden">{listedLabel}</span>

          <RepairFlag note={deal.repairNote} />

          {/* Price */}
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-heading text-[28px] leading-none text-primary tabular-nums sm:text-[32px]">
              {formatPrice(total, deal.currency)}
            </span>
            {deal.originalPrice != null && deal.originalPrice > deal.price && (
              <span className="font-mono text-xs text-muted-foreground line-through">{formatPrice(deal.originalPrice, deal.currency)}</span>
            )}
            {deal.shippingPrice != null ? (
              <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                <Truck className="h-3.5 w-3.5" aria-hidden />
                {deal.shippingPrice === 0
                  ? <>{formatPrice(deal.price, deal.currency)} + free ship</>
                  : <>{formatPrice(deal.price, deal.currency)} + {formatPrice(deal.shippingPrice, deal.currency)}</>}
              </span>
            ) : deal.shipping ? (
              <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                <Truck className="h-3.5 w-3.5" aria-hidden />
                {deal.shipping}
              </span>
            ) : null}
          </div>

          {/* Sold price + condition */}
          <SoldPriceLine deal={deal} />
          <OfferLine deal={deal} shipping={deal.shippingPrice} />

          {/* Seller */}
          {(deal.sellerName || deal.sellerLocation) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
              {deal.sellerName && (deal.sellerSlug ? (
                <a
                  href={`https://www.sweetwater.com/used/storefront/${deal.sellerSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground"
                >
                  {deal.sellerName}
                </a>
              ) : (
                <span className="font-medium text-foreground">{deal.sellerName}</span>
              ))}
              {deal.sellerListingCount != null && (
                <span className={`flex items-center gap-1 ${isShop ? 'text-foreground/70' : 'font-medium text-amber-700'}`} title="Listings this seller has up on Gear Exchange">
                  <Store className="h-3.5 w-3.5" aria-hidden />
                  {deal.sellerListingCount.toLocaleString('en-US')} {deal.sellerListingCount === 1 ? 'listing' : 'listings'}
                </span>
              )}
              {deal.sellerLocation && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {deal.sellerLocation}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions - full width under the card on phones, under the details from sm up */}
        <div className="col-span-2 flex items-center gap-1.5 pt-3 sm:col-span-1 sm:col-start-2 [&>*]:flex-1 sm:[&>*]:flex-none [&>*]:justify-center">
          {deal.sweetwaterLink && (
            <a
              href={deal.sweetwaterLink}
              target="_blank"
              rel="noopener noreferrer"
              className="font-btn inline-flex h-9 items-center gap-1.5 bg-foreground px-3 text-[11px] text-background transition-colors hover:bg-foreground/85 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Sweetwater
            </a>
          )}
          <button onClick={onPurchased} disabled={busy} className={`${ghostBtn} hover:border-emerald-700 hover:text-emerald-800`}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Bought
          </button>
          <button onClick={onDismiss} disabled={busy} className={`${ghostBtn} text-foreground/70 hover:text-foreground`}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            Dismiss
          </button>
        </div>

          {/* Sold history - under the details, full width on phones */}
          <div className="col-span-2 sm:col-span-1 sm:col-start-2">
            <SoldHistory deal={deal} onSetProduct={onSetProduct} />
          </div>
      </div>
    </li>
  );
}
