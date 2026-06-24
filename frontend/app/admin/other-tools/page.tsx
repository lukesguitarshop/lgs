'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, getAdminActivity, type AdminActivityEntry } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AdminTabsNav } from '@/components/admin/AdminTabsNav';
import {
  ArrowLeft, Clipboard, Copy, Check, Play, Loader2, CheckCircle, XCircle, Star,
  Activity, LogIn, ShoppingCart, Heart, HeartOff, Receipt, ChevronLeft, ChevronRight, X,
} from 'lucide-react';

interface ScraperResponse {
  success: boolean;
  message: string;
  output?: string[];
  errors?: string[];
  error?: string;
}

interface Snippet {
  id: string;
  title: string;
  description?: string;
  text: string;
}

const SNIPPETS: Snippet[] = [
  {
    id: 'return-policy',
    title: 'Return Policy',
    description: 'Standard return policy pasted into listing descriptions.',
    text: `Return Policy:

Payment

Item is not reserved or considered sold until payment has fully cleared. Pending or unverified payments do not hold the item.

Pre-purchase Inspection

All buyers are responsible for reviewing every photo and the full listing description before purchasing. Additional photos, measurements, or details are available on request — please ask before you buy, not after. Purchasing constitutes acknowledgment that you have reviewed the listing in full.

All Sales Final

Items are sold as-is. Cancellations are not accepted once payment has cleared. A 15% restocking fee applies to any cancelled order, regardless of shipping or tracking status, as preparation, packing, and handling begin immediately upon sale.

Returns

Returns are by approval only and must be requested within 24 hours of delivery. Approved returns are subject to:

• —A 15% restocking fee (non-negotiable)

• —Return in original condition with all original packaging and accessories

• —Buyer-paid return shipping with full insurance and signature confirmation

• —Refund issued only after the item is received and inspected

Items returned damaged, incomplete, or without insurance are not eligible for refund.

Condition Expectations

You are purchasing a used instrument, not a professionally set-up guitar. Minor adjustments (intonation, action, tuning stability, etc.) are expected and are the buyer's responsibility. “Used” condition is not grounds for a return.

Communication

Questions are welcome before purchase. Message me anytime — I'd rather answer ten questions upfront than deal with a misunderstanding after the sale.`,
  },
  {
    id: 'ups-dispute',
    title: 'UPS Size Dispute',
    description: 'Dispute text for when UPS mis-measures a package.',
    text: `My package dimensions were 45x18x6 inches, as printed directly on the box and confirmed by my own hand measurement prior to shipment; I'm requesting that the size-based charge adjustment be reversed.`,
  },
];

const ACTIVITY_TYPES: { value: string; label: string }[] = [
  { value: '', label: 'All events' },
  { value: 'login', label: 'Logins' },
  { value: 'add_to_cart', label: 'Add to cart' },
  { value: 'favorite', label: 'Favorites' },
  { value: 'unfavorite', label: 'Unfavorites' },
  { value: 'order_placed', label: 'Orders placed' },
];

function getActivityIcon(type: string) {
  switch (type) {
    case 'login':
      return <LogIn className="h-4 w-4 text-blue-600" />;
    case 'add_to_cart':
      return <ShoppingCart className="h-4 w-4 text-[#6E0114]" />;
    case 'favorite':
      return <Heart className="h-4 w-4 text-pink-600" />;
    case 'unfavorite':
      return <HeartOff className="h-4 w-4 text-gray-400" />;
    case 'order_placed':
      return <Receipt className="h-4 w-4 text-green-600" />;
    default:
      return <Activity className="h-4 w-4 text-gray-400" />;
  }
}

function formatActivityDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const ACTIVITY_PER_PAGE = 50;

function OtherToolsContent() {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'activity' ? 'activity' : 'snippets');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reviewScraperLoading, setReviewScraperLoading] = useState(false);
  const [reviewScraperResult, setReviewScraperResult] = useState<ScraperResponse | null>(null);

  // Activity log state
  const [activity, setActivity] = useState<AdminActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityPage, setActivityPage] = useState(1);
  const [activityType, setActivityType] = useState('');
  const [activitySort, setActivitySort] = useState<'newest' | 'oldest'>('newest');
  const [activityUserId, setActivityUserId] = useState<string | null>(searchParams.get('user'));

  const fetchActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const data = await getAdminActivity({
        type: activityType || undefined,
        userId: activityUserId || undefined,
        sort: activitySort,
        page: activityPage,
        perPage: ACTIVITY_PER_PAGE,
      });
      setActivity(data.items);
      setActivityTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch activity feed:', err);
    } finally {
      setActivityLoading(false);
    }
  }, [activityType, activityUserId, activitySort, activityPage]);

  useEffect(() => {
    if (isAdmin && activeTab === 'activity') {
      fetchActivity();
    }
  }, [isAdmin, activeTab, fetchActivity]);

  const totalActivityPages = Math.max(1, Math.ceil(activityTotal / ACTIVITY_PER_PAGE));

  const copySnippet = async (snippet: Snippet) => {
    try {
      await navigator.clipboard.writeText(snippet.text);
      setCopiedId(snippet.id);
      showToast('Copied to clipboard', 'success', 2000);
      setTimeout(() => setCopiedId((prev) => (prev === snippet.id ? null : prev)), 2000);
    } catch {
      showToast('Failed to copy', 'error');
    }
  };

  const runReviewScraper = async () => {
    setReviewScraperLoading(true);
    setReviewScraperResult(null);

    try {
      const response = await api.authPost<ScraperResponse>('/admin/run-review-scraper', {});
      setReviewScraperResult(response);
    } catch (err) {
      setReviewScraperResult({
        success: false,
        message: 'Failed to run review scraper',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setReviewScraperLoading(false);
    }
  };

  if (!isAdmin) return <div className="text-center py-16">Admin access required.</div>;

  return (
    <div className="max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center text-gray-600 hover:text-[#020E1C] transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-[#020E1C] mb-2">Other Tools</h1>
      <p className="text-gray-600 mb-6">Handy utilities for managing your shop</p>

      <AdminTabsNav />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="snippets" className="flex items-center gap-2">
            <Clipboard className="h-4 w-4" />
            <span className="hidden sm:inline">Snippets</span>
          </TabsTrigger>
          <TabsTrigger value="review-scraper" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            <span className="hidden sm:inline">Review Scraper</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Activity Logs</span>
          </TabsTrigger>
        </TabsList>

        {/* Snippets Tab */}
        <TabsContent value="snippets">
          <div className="bg-[#FFFFF3] rounded-lg border border-gray-200 p-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-[#020E1C] flex items-center gap-2">
                <Clipboard className="h-5 w-5" />
                Saved Snippets
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Frequently used text. Click copy to grab it for your listings or disputes.
              </p>
            </div>

            <div className="space-y-4">
              {SNIPPETS.map((snippet) => (
                <div key={snippet.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h3 className="font-semibold text-[#020E1C]">{snippet.title}</h3>
                      {snippet.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{snippet.description}</p>
                      )}
                    </div>
                    <Button
                      onClick={() => copySnippet(snippet)}
                      variant="outline"
                      className="text-sm h-8 flex-shrink-0"
                    >
                      {copiedId === snippet.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 mr-1.5 text-green-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 mr-1.5" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="whitespace-pre-wrap break-words text-sm text-gray-700 bg-[#FFFFF3] border border-gray-200 rounded p-3 max-h-72 overflow-y-auto font-sans">
                    {snippet.text}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Review Scraper Tab */}
        <TabsContent value="review-scraper">
          <div className="bg-[#FFFFF3] rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-[#020E1C] mb-4">Review Scraper</h2>
            <p className="text-gray-600 mb-6">
              Fetch reviews from your Reverb shop feedback. Only imports new reviews that haven&apos;t been imported yet.
            </p>

            <Button
              onClick={runReviewScraper}
              disabled={reviewScraperLoading}
              className="bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3] font-semibold px-6 py-3"
            >
              {reviewScraperLoading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Fetching Reviews...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Run Review Scraper
                </>
              )}
            </Button>

            {reviewScraperResult && (
              <div className="mt-6">
                <div
                  className={`flex items-center gap-2 p-4 rounded-lg ${
                    reviewScraperResult.success
                      ? 'bg-green-50 border border-green-200 text-green-800'
                      : 'bg-red-50 border border-red-200 text-red-800'
                  }`}
                >
                  {reviewScraperResult.success ? (
                    <CheckCircle className="h-5 w-5 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 flex-shrink-0" />
                  )}
                  <span className="font-medium">{reviewScraperResult.message}</span>
                </div>

                {reviewScraperResult.output && reviewScraperResult.output.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Output:</h3>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto max-h-96 overflow-y-auto">
                      {reviewScraperResult.output.join('\n')}
                    </pre>
                  </div>
                )}

                {reviewScraperResult.error && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-red-700 mb-2">Error Details:</h3>
                    <pre className="bg-red-50 text-red-800 p-4 rounded-lg text-sm">{reviewScraperResult.error}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Activity Logs Tab */}
        <TabsContent value="activity">
          <div className="bg-[#FFFFF3] rounded-lg border border-gray-200 p-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-[#020E1C] flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Activity Logs
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Everything users do across the site, most recent first. Click a user to open their profile.
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <select
                value={activityType}
                onChange={(e) => { setActivityType(e.target.value); setActivityPage(1); }}
                className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-[#020E1C]"
              >
                {ACTIVITY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>

              <select
                value={activitySort}
                onChange={(e) => { setActivitySort(e.target.value as 'newest' | 'oldest'); setActivityPage(1); }}
                className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-[#020E1C]"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>

              {activityUserId && (
                <button
                  onClick={() => { setActivityUserId(null); setActivityPage(1); }}
                  className="inline-flex items-center gap-1 h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-[#6E0114] hover:bg-gray-50"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear user filter
                </button>
              )}

              <span className="ml-auto text-sm text-gray-500">
                {activityTotal} event{activityTotal === 1 ? '' : 's'}
              </span>
            </div>

            {activityLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : activity.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No activity found</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-500">
                        <th className="pb-2 pr-4 font-medium">Event</th>
                        <th className="pb-2 pr-4 font-medium">User</th>
                        <th className="pb-2 pr-4 font-medium">Details</th>
                        <th className="pb-2 font-medium whitespace-nowrap">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activity.map((entry) => (
                        <tr key={entry.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <td className="py-2 pr-4">
                            <span className="inline-flex items-center gap-2 whitespace-nowrap">
                              {getActivityIcon(entry.type)}
                              <span className="text-gray-700">{entry.type.replace(/_/g, ' ')}</span>
                            </span>
                          </td>
                          <td className="py-2 pr-4">
                            <Link
                              href={`/admin/user/${entry.userId}`}
                              className="text-[#6E0114] hover:underline font-medium"
                            >
                              {entry.userName}
                            </Link>
                            {entry.userEmail && (
                              <div className="text-xs text-gray-400">{entry.userEmail}</div>
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            {entry.listingId ? (
                              <Link href={`/listing/${entry.listingId}`} className="text-[#020E1C] hover:text-[#6E0114] hover:underline">
                                {entry.description}
                              </Link>
                            ) : (
                              <span className="text-[#020E1C]">{entry.description}</span>
                            )}
                          </td>
                          <td className="py-2 text-gray-500 whitespace-nowrap">
                            {formatActivityDate(entry.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalActivityPages > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={activityPage <= 1}
                      onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Prev
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {activityPage} of {totalActivityPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={activityPage >= totalActivityPages}
                      onClick={() => setActivityPage((p) => Math.min(totalActivityPages, p + 1))}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function OtherToolsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <OtherToolsContent />
    </Suspense>
  );
}
