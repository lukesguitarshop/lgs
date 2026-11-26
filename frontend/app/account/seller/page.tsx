'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle, Guitar, Loader2, Play, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';

interface SellerListing {
  id: string;
  listing_title: string;
  condition: string | null;
  image: string | null;
  price: number;
  currency: string;
  reverb_link: string | null;
  disabled: boolean;
  scraped_at: string;
}

interface SellerOverview {
  reverbConnected: boolean;
  listings: SellerListing[];
}

interface ScrapeResult {
  success: boolean;
  message: string;
  listingsScraped?: number;
  listingsDisabled?: number;
  output?: string[];
}

const primaryButton =
  'font-btn inline-flex h-11 items-center justify-center gap-2 bg-primary px-5 text-[13px] text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer';

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function SellerPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const isSeller = isAuthenticated && !!user?.isSeller;

  const [overview, setOverview] = useState<SellerOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [token, setToken] = useState('');
  const [savingToken, setSavingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);

  const load = useCallback(async () => {
    try {
      setOverview(await api.authGet<SellerOverview>('/seller'));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load your listings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isSeller) {
      // Nothing to fetch; the page renders the sign-in / no-access message instead.
      setLoading(false);
      return;
    }
    load();
  }, [authLoading, isSeller, load]);

  const saveToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingToken(true);
    setTokenError(null);
    try {
      await api.authPut('/seller/reverb-token', { token: token.trim() });
      setToken('');
      await load();
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : 'Failed to save the token');
    } finally {
      setSavingToken(false);
    }
  };

  const disconnect = async () => {
    if (!confirm('Disconnect your Reverb account? Guitars already on the site stay listed until they are removed.')) {
      return;
    }
    try {
      await api.authDelete('/seller/reverb-token');
      setScrapeResult(null);
      await load();
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  };

  const runScraper = async () => {
    setScraping(true);
    setScrapeResult(null);
    try {
      setScrapeResult(await api.authPost<ScrapeResult>('/seller/run-scraper', {}));
    } catch (err) {
      setScrapeResult({
        success: false,
        message: err instanceof Error ? err.message : 'The scraper failed. Try again in a minute.',
      });
    } finally {
      setScraping(false);
      await load();
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return <div className="py-16 text-center">Sign in to manage your Reverb listings.</div>;
  }
  if (!isSeller) {
    return <div className="py-16 text-center">This account doesn&apos;t have seller access.</div>;
  }

  const listings = overview?.listings ?? [];
  const live = listings.filter((l) => !l.disabled);
  const ended = listings.filter((l) => l.disabled);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-4">
      <h1 className="mb-2 font-heading text-[clamp(30px,8vw,34px)] leading-[0.95]">My Reverb listings</h1>
      <p className="mb-8 text-foreground/70">
        Connect your Reverb account, then run the scraper to put your live Reverb guitars on the site.
      </p>

      {loadError && (
        <div className="mb-6 border border-primary/40 bg-primary/5 p-4 text-sm text-primary">{loadError}</div>
      )}

      {overview && !overview.reverbConnected && (
        <section className="mb-8 border border-foreground/15 bg-background p-5">
          <h2 className="mb-2 text-lg font-semibold">Connect your Reverb account</h2>
          <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-foreground/75">
            <li>
              On Reverb, open{' '}
              <a
                href="https://reverb.com/my/api_settings"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                My Account &rarr; API &amp; Integrations
              </a>
              .
            </li>
            <li>
              Generate a personal access token with the <span className="font-mono">read_listings</span> scope.
              Nothing else is needed.
            </li>
            <li>Paste it below.</li>
          </ol>
          <form onSubmit={saveToken} className="flex flex-col gap-3 sm:flex-row">
            <Input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Reverb personal access token"
              aria-label="Reverb personal access token"
              className="flex-1"
            />
            <button type="submit" disabled={savingToken || !token.trim()} className={primaryButton}>
              {savingToken && <Loader2 className="h-4 w-4 animate-spin" />}
              Connect
            </button>
          </form>
          {tokenError && <p className="mt-3 text-sm text-primary">{tokenError}</p>}
          <p className="mt-3 text-xs text-foreground/60">
            The token is stored encrypted and is only used to read your listings. You can disconnect it here, or revoke
            it on Reverb, at any time.
          </p>
        </section>
      )}

      {overview?.reverbConnected && (
        <section className="mb-8 border border-foreground/15 bg-background p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CheckCircle className="h-5 w-5 text-green-700" />
              Reverb connected
            </h2>
            <button
              type="button"
              onClick={disconnect}
              className="cursor-pointer text-sm text-foreground/60 underline hover:text-primary"
            >
              Disconnect
            </button>
          </div>
          <p className="mb-4 text-sm text-foreground/75">
            Running the scraper adds your live Reverb listings to the site and refreshes their photos and descriptions.
            Anything no longer live on your Reverb account is taken off the shop. It can take a minute or two.
          </p>
          <button type="button" onClick={runScraper} disabled={scraping} className={primaryButton}>
            {scraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {scraping ? 'Running scraper...' : 'Run scraper'}
          </button>
          {tokenError && <p className="mt-3 text-sm text-primary">{tokenError}</p>}

          {scrapeResult && (
            <div
              role="status"
              className={`mt-4 border p-4 text-sm ${
                scrapeResult.success
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              <p className="flex items-center gap-2 font-medium">
                {scrapeResult.success ? (
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 flex-shrink-0" />
                )}
                {scrapeResult.success
                  ? `Done: ${scrapeResult.listingsScraped ?? 0} listed, ${scrapeResult.listingsDisabled ?? 0} taken off`
                  : scrapeResult.message}
              </p>
              {scrapeResult.output && scrapeResult.output.length > 0 && (
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs">{scrapeResult.output.join('\n')}</pre>
              )}
            </div>
          )}
        </section>
      )}

      <h2 className="mb-3 text-lg font-semibold">On the site ({live.length})</h2>
      {live.length === 0 ? (
        <p className="text-foreground/70">
          None of your guitars are on the site yet.
          {overview?.reverbConnected ? ' Run the scraper to add them.' : ''}
        </p>
      ) : (
        <div className="space-y-3">
          {live.map((listing) => (
            <ListingRow key={listing.id} listing={listing} />
          ))}
        </div>
      )}

      {ended.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-lg font-semibold">No longer listed ({ended.length})</h2>
          <div className="space-y-3">
            {ended.map((listing) => (
              <ListingRow key={listing.id} listing={listing} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ListingRow({ listing }: { listing: SellerListing }) {
  return (
    <Link
      href={`/listing/${listing.id}`}
      className="flex items-center gap-4 border border-foreground/15 bg-background p-4 transition-colors hover:border-primary"
    >
      <div className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden bg-muted">
        {listing.image ? (
          <Image src={listing.image} alt={listing.listing_title} fill sizes="64px" className="object-cover" />
        ) : (
          <Guitar className="h-7 w-7 text-muted-foreground/60" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-semibold text-foreground">{listing.listing_title}</h3>
        <p className="label-mono-sm mt-1 text-foreground/60">
          {formatPrice(listing.price, listing.currency)}
          {listing.condition ? ` · ${listing.condition}` : ''}
          {listing.disabled ? ' · Sold or ended' : ''}
        </p>
      </div>
    </Link>
  );
}
