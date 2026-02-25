'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink, X, Check, TrendingDown, RefreshCw, Play, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { getPotentialBuys, getPotentialBuyStats, dismissPotentialBuy, dismissPotentialBuysBulk, dismissAllPotentialBuys, deleteAllPotentialBuys, markPotentialBuyPurchased, runDealFinder, getDealFinderStatus } from '@/lib/api';
import type { PotentialBuy, PotentialBuyStats } from '@/lib/types/potential-buy';

export function DealFinderTab() {
  const [deals, setDeals] = useState<PotentialBuy[]>([]);
  const [stats, setStats] = useState<PotentialBuyStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('deals');
  const [sortBy, setSortBy] = useState<string>('best-deal');
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

  const fetchDeals = async (page = currentPage) => {
    setLoading(true);
    setFetchError(null);
    try {
      const [dealsData, statsData] = await Promise.all([
        getPotentialBuys(statusFilter, sortBy, page, perPage),
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

  useEffect(() => {
    setCurrentPage(1);
    fetchDeals(1);
  }, [statusFilter, sortBy]);

  // Check scraper status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await getDealFinderStatus();
        setScraperRunning(status.isRunning);
      } catch (err) {
        console.error('Failed to check scraper status:', err);
      }
    };
    checkStatus();
  }, []);

  const handleRunScraper = async () => {
    setScraperRunning(true);
    setScraperResult(null);
    try {
      const result = await runDealFinder();
      setScraperResult({
        success: result.success,
        message: result.success
          ? `Found ${result.dealsFound} deals from ${result.listingsChecked} listings (${result.duration})`
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

  const handleDismiss = async (id: string) => {
    setActionLoading(id);
    try {
      await dismissPotentialBuy(id);
      setDeals(prev => prev.filter(d => d.id !== id));
      if (stats) {
        setStats({ ...stats, deals: stats.deals - 1 });
      }
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
      if (stats) {
        setStats({ ...stats, deals: stats.deals - 1 });
      }
    } catch (err) {
      console.error('Failed to mark as purchased:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismissPage = async () => {
    if (deals.length === 0) return;
    if (!confirm(`Dismiss all ${deals.length} deals on this page?`)) return;

    setBulkDismissing('page');
    try {
      const ids = deals.map(d => d.id);
      const result = await dismissPotentialBuysBulk(ids);
      setDeals([]);
      if (stats) {
        setStats({ ...stats, deals: Math.max(0, stats.deals - result.dismissed) });
      }
      // Refresh to get next page of results
      await fetchDeals(1);
    } catch (err) {
      console.error('Failed to dismiss page:', err);
    } finally {
      setBulkDismissing(null);
    }
  };

  const handleDismissAll = async () => {
    if (!stats || stats.deals === 0) return;
    if (!confirm(`Dismiss ALL ${stats.deals} active deals? This cannot be undone.`)) return;

    setBulkDismissing('all');
    try {
      await dismissAllPotentialBuys();
      setDeals([]);
      if (stats) {
        setStats({ ...stats, deals: 0 });
      }
    } catch (err) {
      console.error('Failed to dismiss all:', err);
    } finally {
      setBulkDismissing(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('DELETE ALL scanned listings from the database? This permanently removes all data and cannot be undone.')) return;

    setDeleting(true);
    try {
      await deleteAllPotentialBuys();
      setDeals([]);
      setStats({ total: 0, deals: 0, lastRunAt: undefined });
      setTotalItems(0);
      setTotalPages(1);
      setCurrentPage(1);
    } catch (err) {
      console.error('Failed to delete all:', err);
    } finally {
      setDeleting(false);
    }
  };

  const formatPrice = (price: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Deal Finder
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Guitars priced below their Reverb Price Guide value
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleRunScraper}
            disabled={scraperRunning}
            variant="default"
            className="text-sm bg-[#df5e15] hover:bg-[#c54d0d]"
          >
            {scraperRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            <span className="ml-2">{scraperRunning ? 'Running...' : 'Run Scraper'}</span>
          </Button>
          <Button
            onClick={() => fetchDeals()}
            disabled={loading}
            variant="outline"
            className="text-sm"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Refresh</span>
          </Button>
          <Button
            onClick={handleDeleteAll}
            disabled={deleting || loading}
            variant="outline"
            className="text-sm text-red-600 hover:text-red-800 hover:bg-red-50 border-red-200"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            <span className="ml-2">Delete All</span>
          </Button>
        </div>
      </div>

      {/* Scraper Result Message */}
      {scraperResult && (
        <div className={`mb-4 p-3 rounded-lg ${scraperResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {scraperResult.message}
        </div>
      )}

      {/* Fetch Error Message */}
      {fetchError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">
          <strong>Error loading deals:</strong> {fetchError}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-2xl font-bold text-gray-900">{stats.deals}</p>
            <p className="text-sm text-gray-600">Active Deals</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-600">Total Scanned</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm font-medium text-gray-900">
              {stats.lastRunAt ? formatDate(stats.lastRunAt) : 'Never'}
            </p>
            <p className="text-sm text-gray-600">Last Scan</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-gray-100">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-[#df5e15] focus:border-transparent outline-none"
            >
              <option value="deals">Deals Only</option>
              <option value="no-price-guide">No Price Guide</option>
              <option value="dismissed">Dismissed</option>
              <option value="purchased">Purchased</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Sort:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-[#df5e15] focus:border-transparent outline-none"
            >
              <option value="best-deal">Best Deal First</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Bulk Action Buttons - only show on deals filter */}
        {statusFilter === 'deals' && deals.length > 0 && (
          <div className="flex gap-2">
            <Button
              onClick={() => {
                const links = deals.filter(d => d.reverbLink).map(d => d.reverbLink!);
                links.forEach(link => window.open(link, '_blank'));
              }}
              disabled={loading}
              variant="outline"
              size="sm"
              className="text-xs text-[#df5e15] hover:text-[#c54d0d] hover:bg-orange-50"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open All ({deals.filter(d => d.reverbLink).length})
            </Button>
            <Button
              onClick={handleDismissPage}
              disabled={bulkDismissing !== null || loading}
              variant="outline"
              size="sm"
              className="text-xs text-gray-600 hover:text-gray-800"
            >
              {bulkDismissing === 'page' ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <X className="h-3 w-3 mr-1" />
              )}
              Dismiss Page ({deals.length})
            </Button>
            <Button
              onClick={handleDismissAll}
              disabled={bulkDismissing !== null || loading || !stats?.deals}
              variant="outline"
              size="sm"
              className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50"
            >
              {bulkDismissing === 'all' ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <X className="h-3 w-3 mr-1" />
              )}
              Dismiss All ({stats?.deals ?? 0})
            </Button>
          </div>
        )}
      </div>

      {/* Results count */}
      <div className="mb-4">
        <span className="text-sm text-gray-500">
          Showing {deals?.length ?? 0} of {totalItems} results (Page {currentPage} of {totalPages})
        </span>
      </div>

      {/* Deals List */}
      {loading && deals.length === 0 ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : deals.length === 0 ? (
        <div className="text-center py-8">
          <TrendingDown className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No deals found</p>
          <p className="text-gray-400 text-sm">Run the deal finder scraper to find new deals</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {deals.map((deal) => (
              <div
                key={deal.id}
                className="border rounded-lg p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex gap-4">
                  {/* Image */}
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {deal.images?.[0] ? (
                      <Image
                        src={deal.images[0]}
                        alt={deal.listingTitle}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">
                        🎸
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-900 line-clamp-2">
                        {deal.listingTitle}
                      </h3>
                      {deal.discountPercent && deal.discountPercent > 0 && (
                        <span className="flex-shrink-0 px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                          {deal.discountPercent.toFixed(0)}% below
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className="font-bold text-lg text-[#df5e15]">
                        {formatPrice(deal.price, deal.currency)}
                      </span>
                      {deal.hasPriceGuide && deal.priceGuideLow && deal.priceGuideHigh && (
                        <span className="text-gray-500">
                          Guide: {formatPrice(deal.priceGuideLow)} - {formatPrice(deal.priceGuideHigh)}
                        </span>
                      )}
                      {deal.condition && (
                        <span className="text-gray-500">
                          {deal.condition}
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-gray-400">
                      Found: {formatDate(deal.firstSeenAt)}
                    </p>

                    {/* Actions */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {deal.reverbLink && (
                        <a
                          href={deal.reverbLink}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button size="sm" variant="outline" className="text-xs h-8">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View on Reverb
                          </Button>
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => handleMarkPurchased(deal.id)}
                        disabled={actionLoading === deal.id}
                      >
                        {actionLoading === deal.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Purchased
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 text-gray-500 hover:text-gray-700"
                        onClick={() => handleDismiss(deal.id)}
                        disabled={actionLoading === deal.id}
                      >
                        {actionLoading === deal.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <X className="h-3 w-3 mr-1" />
                            Dismiss
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-gray-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchDeals(currentPage - 1)}
                disabled={currentPage <= 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === currentPage ? 'default' : 'outline'}
                      size="sm"
                      className={`w-9 ${pageNum === currentPage ? 'bg-[#df5e15] hover:bg-[#c54d0d]' : ''}`}
                      onClick={() => fetchDeals(pageNum)}
                      disabled={loading}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchDeals(currentPage + 1)}
                disabled={currentPage >= totalPages || loading}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
