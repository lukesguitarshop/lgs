'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Loader2, ExternalLink, X, Check, RefreshCw, Play, Trash2, Search, Star, MapPin, Truck, Zap, Clock, BadgeCheck, HelpCircle } from 'lucide-react';
import { getPotentialBuys, getPotentialBuyStats, dismissPotentialBuy, dismissPotentialBuysBulk, dismissAllPotentialBuys, deleteAllPotentialBuys, markPotentialBuyPurchased, runDealFinder, getDealFinderStatus, quickCheckDealFinder, setPotentialBuyProduct } from '@/lib/api';
import type { ProductTarget } from '@/lib/api';
import type { PotentialBuy, PotentialBuyStats } from '@/lib/types/potential-buy';
import { MedianBadge, OfferLine, RepairFlag, SoldHistory, SoldPriceLine } from './SoldHistory';
import { formatPrice, formatDate, timeAgo, inputClass, selectClass, ghostBtn, StatCell, ViewTabs, ListSkeleton, PageNav } from './deal-finder-shared';
import { appLink } from '@/lib/app-links';

const minutesBetween = (from: string, to: string) =>
  Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));

/** Sellers with more reviews than this are established shops, not the private sellers deals come from. */
const SMALL_SELLER_MAX_REVIEWS = 100;

type View = 'deals' | 'priced' | 'no-price-guide' | 'missed';

export function DealFinderTab() {
  const [deals, setDeals] = useState<PotentialBuy[]>([]);
  const [stats, setStats] = useState<PotentialBuyStats | null>(null);
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
  const [quickChecking, setQuickChecking] = useState(false);
  const [lastQuickCheckAt, setLastQuickCheckAt] = useState<string | null>(null);
  const [scraperResult, setScraperResult] = useState<{ success: boolean; message: string } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [bulkDismissing, setBulkDismissing] = useState<'page' | 'all' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const perPage = 20;
  const view: View = statusFilter === 'missed' || statusFilter === 'no-price-guide' || statusFilter === 'priced' ? statusFilter : 'deals';
  const isPricedView = view === 'priced';
  const isMissedView = view === 'missed';
  const isNoPriceView = view === 'no-price-guide';
  // The list on screen when it's one you work through (not dismissed/purchased/missed)
  const activeList = statusFilter === 'deals' || statusFilter === 'no-price-guide' ? statusFilter : null;
  const activeCount = activeList === 'no-price-guide' ? stats?.noPriceGuide ?? 0 : stats?.deals ?? 0;

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

  const fetchDeals = async (page = currentPage) => {
    setLoading(true);
    setFetchError(null);
    try {
      const [dealsData, statsData] = await Promise.all([
        getPotentialBuys(statusFilter, sortBy, page, perPage, appliedFilters.search || undefined, appliedFilters.minPrice, appliedFilters.maxPrice, smallSellersOnly ? SMALL_SELLER_MAX_REVIEWS : undefined),
        getPotentialBuyStats()
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
      console.error('Failed to fetch deals:', errorMessage);
      setFetchError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // The quick check below finishes after the first render; this keeps its refetch on
  // whatever filters are applied by then rather than the ones from mount.
  const fetchDealsRef = useRef(fetchDeals);
  fetchDealsRef.current = fetchDeals;

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

  // Check scraper status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await getDealFinderStatus();
        setScraperRunning(status.isRunning);
        setLastQuickCheckAt(status.lastQuickCheckAt ?? null);
      } catch (err) {
        console.error('Failed to check scraper status:', err);
      }
    };
    checkStatus();
  }, []);

  // Pick up anything published since the last scheduled quick check
  useEffect(() => {
    let cancelled = false;
    const quickCheck = async () => {
      setQuickChecking(true);
      try {
        const result = await quickCheckDealFinder();
        if (cancelled) return;
        setLastQuickCheckAt(result.lastQuickCheckAt ?? null);
        if (result.ran) {
          await fetchDealsRef.current();
        }
      } catch (err) {
        console.error('Deal finder quick check failed:', err);
      } finally {
        if (!cancelled) setQuickChecking(false);
      }
    };
    quickCheck();
    return () => { cancelled = true; };
  }, []);

  // Re-render once a minute so the "12m ago" times stay honest while the tab sits open
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const handleRunScraper = async () => {
    setScraperRunning(true);
    setScraperResult(null);
    try {
      const result = await runDealFinder();
      setScraperResult({
        success: result.success,
        message: result.success
          ? `Found ${result.dealsFound} deals from ${result.listingsChecked} listings, ${result.withPriceData ?? 0} with price data${result.lookupErrors ? `, ${result.lookupErrors} lookup errors` : ''} (${result.duration})`
          : result.message
      });
      // Refresh the deals list after scraper completes
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
    const updated = await setPotentialBuyProduct(id, target);
    setDeals(prev => prev.map(d => (d.id === id ? updated : d)));
  };

  const handleDismiss = async (id: string) => {
    setActionLoading(id);
    try {
      await dismissPotentialBuy(id);
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
      await markPotentialBuyPurchased(id);
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
      const ids = deals.map(d => d.id);
      const result = await dismissPotentialBuysBulk(ids);
      setDeals([]);
      decrementActive(result.dismissed);
      // Refresh to get next page of results
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
      await dismissAllPotentialBuys(activeList);
      setDeals([]);
      decrementActive(activeCount);
    } catch (err) {
      console.error('Failed to dismiss all:', err);
    } finally {
      setBulkDismissing(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('DELETE ALL scanned listings from the database? This permanently removes all data and cannot be undone. Missed deal history is kept.')) return;

    setDeleting(true);
    try {
      await deleteAllPotentialBuys();
      setDeals([]);
      setStats(prev => ({ ...(prev ?? { total: 0, deals: 0 }), total: 0, deals: 0, noPriceGuide: 0, lastRunAt: undefined }));
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
    setSortBy(next === 'missed' ? 'sold-newest' : next === 'priced' ? 'best-deal' : 'listed-newest');
  };

  // Latest of the last full sweep and the last quick check - a quick check that finds
  // nothing new writes no records, so stats.lastRunAt alone would look stale.
  const lastScan = [stats?.lastRunAt, lastQuickCheckAt]
    .filter((d): d is string => !!d)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  const hasFilters = !!(searchInput || minPriceInput || maxPriceInput || smallSellersOnly);

  return (
    <section className="border border-foreground/15 bg-background">
      {/* Header */}
      <div className="border-t-4 border-b border-t-primary border-b-foreground/15 px-4 pt-5 pb-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="label-mono text-primary">Deal finder · delivered to 43082</p>
            <h2 className="font-heading mt-1.5 text-[34px] leading-none text-foreground uppercase sm:text-[42px]">
              Reverb Deals
            </h2>
            <p className="mt-2 flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2" aria-hidden>
                {quickChecking && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />}
                <span className={`relative inline-flex h-2 w-2 rounded-full ${quickChecking ? 'bg-primary' : 'bg-emerald-600'}`} />
              </span>
              {quickChecking
                ? 'Checking Reverb now…'
                : lastScan ? `Live · checked ${timeAgo(lastScan)}` : 'Not scanned yet'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => fetchDeals()}
              disabled={loading}
              className={ghostBtn}
              aria-label="Refresh"
            >
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
          <StatCell value={stats.missedLast7Days ?? 0} label="Missed · 7 days" onClick={() => switchView('missed')} active={isMissedView} accent />
          <StatCell value={stats.total} label="Scanned" />
          <StatCell
            value={lastScan ? timeAgo(lastScan) : '—'}
            label="Last check"
            small
          />
        </div>
      )}

      <div className="px-4 pb-6 sm:px-6">
        {/* Tabs */}
        <ViewTabs
          tabs={[
            { value: 'deals', label: 'Deals', count: stats?.deals },
            { value: 'priced', label: 'Priced', count: stats?.priced },
            { value: 'no-price-guide', label: 'No price guide', count: stats?.noPriceGuide },
            { value: 'missed', label: 'Missed deals', count: stats?.missedLast30Days },
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

        {isMissedView && (
          <div className="mt-4 flex gap-3 border border-foreground/15 bg-foreground/[0.03] p-3 sm:p-4">
            <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
            <div className="text-sm text-foreground/80">
              <p>
                Guitars that <strong className="text-foreground">sold on Reverb within 30 minutes</strong> of the deal finder finding them. Removed or ended listings don&apos;t count.
              </p>
              <p className="mt-1.5 font-mono text-xs text-muted-foreground">
                {stats?.missedLast30Days ?? 0} missed in the last 30 days · {stats?.missedInDealsLast30Days ?? 0} of them were in your Deals or No price guide list
              </p>
            </div>
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
            title={`Hide guitars from sellers with more than ${SMALL_SELLER_MAX_REVIEWS} reviews`}
            className={`font-btn inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 border px-3 text-[11px] whitespace-nowrap transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none ${
              smallSellersOnly ? 'border-foreground bg-foreground text-background' : 'border-foreground/20 bg-background text-foreground hover:border-foreground'
            }`}
          >
            <Star className="h-3.5 w-3.5" aria-hidden />
            ≤{SMALL_SELLER_MAX_REVIEWS} reviews
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
              {isMissedView && <option value="sold-newest">Most recently sold</option>}
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
                  deals.filter(d => d.reverbLink).forEach(d => window.open(d.reverbLink!, '_blank'));
                }}
                disabled={loading}
                className={ghostBtn}
              >
                <ExternalLink className="h-3 w-3" />
                Open all ({deals.filter(d => d.reverbLink).length})
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
              {isMissedView ? 'Nothing missed yet' : isPricedView ? 'Nothing priced yet' : isNoPriceView ? 'Nothing without a price guide' : 'No deals right now'}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {hasFilters
                ? 'Try adjusting your search or price filters.'
                : isMissedView
                  ? 'Guitars that sell within 30 minutes of being found will show up here.'
                  : isPricedView
                    ? "Guitars with a trusted sold price that aren't deals will show up here."
                  : isNoPriceView
                    ? 'Listings without a trusted sold price will show up here.'
                    : 'New listings are checked every 15 minutes. Run a full scan to sweep everything now.'}
            </p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-foreground/10">
              {deals.map((deal) => (
                <DealRow
                  key={deal.id}
                  deal={deal}
                  missedView={isMissedView}
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

function DealRow({ deal, missedView, busy, onPurchased, onDismiss, onSetProduct }: {
  deal: PotentialBuy;
  missedView: boolean;
  busy: boolean;
  onPurchased: () => void;
  onDismiss: () => void;
  onSetProduct: (target: ProductTarget) => Promise<void>;
}) {
  const total = deal.totalPrice ?? deal.price;
  // Below (positive) or above (negative) the sold median - shown for every trusted price
  const discount = deal.hasPriceGuide && deal.discountPercent != null ? deal.discountPercent : null;
  const soldInMinutes = deal.soldAt ? minutesBetween(deal.firstSeenAt, deal.soldAt) : null;
  const fewReviews = deal.sellerFeedbackCount != null && deal.sellerFeedbackCount < 5;

  return (
    <li className="group py-4">
      <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-5">
        {/* Photo */}
        <a
          href={appLink(deal.reverbLink)}
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
              className={`object-cover transition-transform duration-300 group-hover:scale-[1.03] ${missedView ? 'grayscale-[60%]' : ''}`}
            />
          ) : (
            <span className="label-mono-sm absolute inset-0 flex items-center justify-center text-foreground/45">No photo</span>
          )}
          {missedView && soldInMinutes != null ? (
            <span className="label-mono-sm absolute inset-x-0 bottom-0 bg-primary px-2 py-1.5 text-center text-primary-foreground">
              Sold in {soldInMinutes}m
            </span>
          ) : discount != null ? (
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
              href={appLink(deal.reverbLink)}
              target="_blank"
              rel="noopener noreferrer"
              className="line-clamp-2 text-[15px] leading-snug font-semibold text-foreground transition-colors hover:text-primary sm:text-base"
            >
              {deal.listingTitle}
            </a>
            <span className="label-mono-sm hidden flex-shrink-0 pt-1 text-muted-foreground sm:block" title={deal.listingCreatedAt ? `Listed ${formatDate(deal.listingCreatedAt)}` : undefined}>
              {deal.listingCreatedAt ? `Listed ${timeAgo(deal.listingCreatedAt)}` : `Found ${timeAgo(deal.firstSeenAt)}`}
            </span>
          </div>
          <span className="label-mono-sm mt-1 text-muted-foreground sm:hidden">
            {deal.listingCreatedAt ? `Listed ${timeAgo(deal.listingCreatedAt)}` : `Found ${timeAgo(deal.firstSeenAt)}`}
          </span>

          <RepairFlag note={deal.repairNote} />

          {/* Price */}
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-heading text-[28px] leading-none text-primary tabular-nums sm:text-[32px]">
              {formatPrice(total, deal.currency)}
            </span>
            {deal.totalPrice != null && (
              <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                <Truck className="h-3.5 w-3.5" aria-hidden />
                {deal.shippingPrice == null
                  ? <span className="text-primary">Doesn&apos;t ship to {deal.shipToPostalCode ?? 'you'}</span>
                  : deal.shippingPrice === 0
                    ? <>{formatPrice(deal.price, deal.currency)} + free ship</>
                    : <>{formatPrice(deal.price, deal.currency)} + {formatPrice(deal.shippingPrice, deal.currency)}{deal.shippingEstimated && <span title="Reverb's estimate - the exact rate depends on the buyer's address"> est.</span>}</>}
              </span>
            )}
          </div>

          {/* Sold price + condition */}
          <SoldPriceLine deal={deal} />
          <OfferLine deal={deal} shipping={deal.shippingPrice} />

          {/* Seller */}
          {deal.sellerName && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
              {deal.sellerSlug ? (
                <a
                  href={appLink(`https://reverb.com/shop/${deal.sellerSlug}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground"
                >
                  {deal.sellerName}
                </a>
              ) : (
                <span className="font-medium text-foreground">{deal.sellerName}</span>
              )}
              {deal.sellerFeedbackCount != null && (
                <span className={`flex items-center gap-1 ${fewReviews ? 'font-medium text-amber-700' : 'text-foreground/70'}`}>
                  <Star className={`h-3.5 w-3.5 ${fewReviews ? '' : 'fill-amber-400 text-amber-400'}`} aria-hidden />
                  {deal.sellerFeedbackCount.toLocaleString('en-US')} {deal.sellerFeedbackCount === 1 ? 'review' : 'reviews'}
                  {deal.sellerRating != null && deal.sellerFeedbackCount > 0 && (
                    <span className="text-muted-foreground">
                      {' '}· {(deal.sellerRating * 100).toFixed(deal.sellerRating >= 0.995 ? 0 : 1)}%
                    </span>
                  )}
                </span>
              )}
              {deal.sellerLocation && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {deal.sellerLocation.replace(/, United States$/, '')}
                </span>
              )}
              {deal.sellerPreferred && (
                <span className="flex items-center gap-1 text-blue-700">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                  Preferred
                </span>
              )}
            </div>
          )}

          {/* Missed details */}
          {missedView && deal.soldAt && (
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
              <span className="flex items-center gap-1 text-primary">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                Found {formatDate(deal.firstSeenAt)} · sold by {formatDate(deal.soldAt)}
              </span>
              <span className={deal.wasInDeals ? 'text-amber-800' : undefined}>
                {!deal.wasInDeals
                  ? '○ Not flagged as a deal'
                  : deal.hasPriceGuide ? '● Was in your Deals list' : '● Was in No price guide'}
              </span>
            </p>
          )}

        </div>

          {/* Actions - full width under the card on phones, under the details from sm up */}
          <div className="col-span-2 flex items-center gap-1.5 pt-3 sm:col-span-1 sm:col-start-2 [&>*]:flex-1 sm:[&>*]:flex-none [&>*]:justify-center">
            {deal.reverbLink && (
              <a
                href={appLink(deal.reverbLink)}
                target="_blank"
                rel="noopener noreferrer"
                className={`font-btn inline-flex h-9 items-center gap-1.5 px-3 text-[11px] transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none ${missedView ? 'border border-foreground/20 hover:border-foreground' : 'bg-foreground text-background hover:bg-foreground/85'}`}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Reverb
              </a>
            )}
            {!missedView && (
              <>
                <button onClick={onPurchased} disabled={busy} className={`${ghostBtn} hover:border-emerald-700 hover:text-emerald-800`}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Bought
                </button>
                <button onClick={onDismiss} disabled={busy} className={`${ghostBtn} text-foreground/70 hover:text-foreground`}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  Dismiss
                </button>
              </>
            )}
          </div>

          {/* Sold history - under the details, full width on phones */}
          <div className="col-span-2 sm:col-span-1 sm:col-start-2">
            <SoldHistory deal={deal} onSetProduct={onSetProduct} />
          </div>
      </div>
    </li>
  );
}
