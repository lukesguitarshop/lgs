'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AdminTabsNav } from '@/components/admin/AdminTabsNav';
import { ArrowLeft, Clipboard, Copy, Check, Play, Loader2, CheckCircle, XCircle, Star } from 'lucide-react';

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

export default function OtherToolsPage() {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('snippets');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reviewScraperLoading, setReviewScraperLoading] = useState(false);
  const [reviewScraperResult, setReviewScraperResult] = useState<ScraperResponse | null>(null);

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
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="snippets" className="flex items-center gap-2">
            <Clipboard className="h-4 w-4" />
            <span className="hidden sm:inline">Snippets</span>
          </TabsTrigger>
          <TabsTrigger value="review-scraper" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            <span className="hidden sm:inline">Review Scraper</span>
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
                  <pre className="whitespace-pre-wrap break-words text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded p-3 max-h-72 overflow-y-auto font-sans">
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
      </Tabs>
    </div>
  );
}
