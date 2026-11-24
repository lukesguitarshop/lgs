'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Eye, Loader2 } from 'lucide-react';
import { getViewAnalytics, type ViewAnalytics } from '@/lib/api';
import { listingPath } from '@/lib/seo';

/**
 * The admin Analytics page. Each kind of analytics is one <Section>, fed by its own
 * endpoint under /admin/analytics, so adding one is a new component in the list at the
 * bottom of this file and nothing else here has to change.
 */

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
] as const;

/** Day keys are UTC dates; format them as written rather than shifting to local time. */
function formatDay(day: string, withYear = false): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: withYear ? 'numeric' : undefined,
    timeZone: 'UTC',
  });
}

function Section({ title, hint, actions, children }: {
  title: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#020E1C]">{title}</h2>
          {hint && <p className="mt-1 text-sm text-gray-600">{hint}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function StatTile({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-[#FFFFF3] p-4">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[#020E1C]">{value.toLocaleString()}</p>
      {note && <p className="mt-1 text-xs text-gray-500">{note}</p>}
    </div>
  );
}

function ListingViewsSection() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<ViewAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getViewAnalytics(days)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load view analytics.');
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  // The response echoes its range, so a mismatch means the new range is still loading.
  const loading = !error && data?.days !== days;
  const rangeLabel = RANGES.find((r) => r.days === days)?.label ?? `${days} days`;

  return (
    <Section
      title="Listing views"
      hint="One view per visitor per guitar per day. Bots and your own visits are left out. Days are UTC."
      actions={
        <div className="inline-flex rounded-md border border-gray-300 bg-white p-0.5" role="group" aria-label="Date range">
          {RANGES.map((range) => (
            <button
              key={range.days}
              type="button"
              onClick={() => setDays(range.days)}
              aria-pressed={days === range.days}
              className={`min-h-9 rounded px-3 text-sm font-medium transition-colors ${
                days === range.days ? 'bg-[#020E1C] text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      }
    >
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
      ) : !data ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#6E0114]" />
        </div>
      ) : (
        <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Today" value={data.totals.today} />
            <StatTile label="Last 7 days" value={data.totals.last_7_days} />
            <StatTile
              label={`Last ${rangeLabel}`}
              value={data.totals.in_range}
              note={`${data.totals.listings_viewed.toLocaleString()} guitar${data.totals.listings_viewed === 1 ? '' : 's'} viewed`}
            />
            <StatTile label="All time" value={data.totals.all_time} note="Since view tracking began" />
          </div>

          <div className="rounded-lg border border-gray-200 bg-[#FFFFF3] p-4 sm:p-6">
            <h3 className="mb-4 text-lg font-semibold text-[#020E1C]">Views per day</h3>
            {data.totals.in_range === 0 ? (
              <p className="py-12 text-center text-sm text-gray-500">No views recorded in this range yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.daily} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                  <CartesianGrid vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(day: string) => formatDay(day)}
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    tickLine={false}
                    axisLine={{ stroke: '#d1d5db' }}
                    minTickGap={24}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(2, 14, 28, 0.06)' }}
                    labelFormatter={(day) => formatDay(String(day), true)}
                    formatter={(value: number | undefined) => [(value ?? 0).toLocaleString(), 'Views']}
                    contentStyle={{ backgroundColor: '#FFFFF3', border: '1px solid #e5e7eb', borderRadius: 6 }}
                    labelStyle={{ color: '#020E1C', fontWeight: 600 }}
                    itemStyle={{ color: '#020E1C' }}
                  />
                  <Bar dataKey="views" fill="#6E0114" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-[#FFFFF3] p-4 sm:p-6">
            <h3 className="mb-4 text-lg font-semibold text-[#020E1C]">Most viewed, last {rangeLabel}</h3>
            {data.top_listings.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">Nothing viewed in this range yet.</p>
            ) : (
              <ol className="divide-y divide-gray-200">
                {data.top_listings.map((listing, index) => (
                  <li key={listing.id} className="flex items-center gap-3 py-3">
                    <span className="w-5 shrink-0 text-right text-sm tabular-nums text-gray-500">{index + 1}</span>
                    {listing.image ? (
                      <Image
                        src={listing.image}
                        alt=""
                        width={48}
                        height={48}
                        className="h-12 w-12 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 shrink-0 rounded bg-gray-200" />
                    )}
                    <div className="min-w-0 flex-1">
                      <a
                        href={listingPath(listing.id, listing.listing_title)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="line-clamp-2 font-medium text-[#020E1C] hover:text-[#6E0114] hover:underline"
                      >
                        {listing.listing_title}
                      </a>
                      <p className="mt-0.5 text-xs text-gray-500">
                        ${listing.price.toLocaleString()}
                        {listing.disabled && ' · Sold or disabled'}
                        {' · '}
                        {listing.watchers.toLocaleString()} watcher{listing.watchers === 1 ? '' : 's'}
                        {' · '}
                        {listing.all_time_views.toLocaleString()} all time
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-base font-semibold tabular-nums text-[#020E1C]">
                      <Eye className="h-4 w-4 text-gray-400" aria-hidden />
                      {listing.views.toLocaleString()}
                      <span className="sr-only"> views</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}

export function AnalyticsTab() {
  return (
    <div className="space-y-10">
      <ListingViewsSection />
      {/* New analytics sections go here, one component each. */}
    </div>
  );
}
