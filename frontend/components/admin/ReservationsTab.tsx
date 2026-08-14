'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  AlertTriangle,
  Clock,
  DollarSign,
  Bookmark,
  UserX,
  ChevronRight,
} from 'lucide-react';
import {
  getAdminReservations,
  getReservationSummary,
  migrateLegacyPending,
} from '@/lib/api';
import {
  RESERVATION_STATUS_OPTIONS,
  RESERVATION_TYPE_OPTIONS,
  statusBadgeClasses,
  typeBadgeClasses,
  relativeExpiry,
  isExpiringSoon,
  formatCurrency,
  type AdminReservation,
  type ReservationSummary,
} from '@/lib/types/reservation';

/**
 * Reservations list.
 *
 * Deliberately read-only: every row links through to /admin/reservations/{id},
 * where the actions live. Keeping actions off the list stops the row turning
 * into a wall of tiny buttons and gives destructive operations room to breathe.
 *
 * Lives inside the Other Tools page — holds are occasional, so they don't
 * warrant a permanent top-level tab. The host page owns the admin gate.
 */
export function ReservationsTab() {
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [summary, setSummary] = useState<ReservationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active-only is on by default so the list shows what's live.
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);

  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, stats] = await Promise.all([
        getAdminReservations({
          status: statusFilter || undefined,
          type: typeFilter || undefined,
          activeOnly: activeOnly && !statusFilter,
        }),
        getReservationSummary(),
      ]);
      setReservations(rows);
      setSummary(stats);
    } catch (err) {
      setError(
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Could not load reservations.'
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, activeOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const handleMigrate = async () => {
    setMigrating(true);
    setMigrationResult(null);
    try {
      const result = await migrateLegacyPending();
      setMigrationResult(
        `Found ${result.found} legacy pending listing${result.found === 1 ? '' : 's'}: ` +
          `${result.created} migrated, ${result.skipped} already had a reservation` +
          (result.errors.length ? `, ${result.errors.length} failed` : '') +
          '.'
      );
      await load();
    } catch (err) {
      setMigrationResult(
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Migration failed.'
      );
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-nav text-xl text-[#020E1C]">Reservations</h2>
          <p className="text-sm text-gray-600">
            Holds, trade-ins and accepted offers — who each guitar is promised to.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleMigrate} disabled={migrating}>
          {migrating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Migrate legacy pending
        </Button>
      </div>

      {migrationResult && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          {migrationResult}
        </div>
      )}

      {/* Counters */}
      {summary && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            icon={<Bookmark className="h-4 w-4" />}
            label="Active holds"
            value={String(summary.active_holds)}
          />
          <SummaryCard
            icon={<DollarSign className="h-4 w-4" />}
            label="Deposits held"
            value={formatCurrency(summary.deposits_held)}
          />
          <SummaryCard
            icon={<Clock className="h-4 w-4" />}
            label="Expiring in 48h"
            value={String(summary.expiring_48h)}
            highlight={summary.expiring_48h > 0}
          />
          <SummaryCard
            icon={<UserX className="h-4 w-4" />}
            label="Needs attention"
            value={String(summary.needs_review + summary.unassigned)}
            highlight={summary.needs_review + summary.unassigned > 0}
          />
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-[#FFFFF3] px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          {RESERVATION_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-[#FFFFF3] px-3 py-1.5 text-sm"
        >
          <option value="">All types</option>
          {RESERVATION_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
          <option value="offer_accepted">Accepted Offer</option>
        </select>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={activeOnly}
            disabled={!!statusFilter}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <span className={statusFilter ? 'text-gray-400' : ''}>Active only</span>
        </label>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#6E0114]" />
        </div>
      ) : reservations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center text-gray-500">
          No reservations match these filters.
        </div>
      ) : (
        <div className="space-y-2">
          {reservations.map((r) => (
            <ReservationRow key={r.id} reservation={r} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One reservation as a clickable card. Everything the shop owner scans for at a
 * glance — who, what, how much, how long left — with the detail page a click away.
 */
function ReservationRow({ reservation: r }: { reservation: AdminReservation }) {
  const urgent = r.is_expired || isExpiringSoon(r.expires_at);
  const needsAttention = r.needs_review || r.is_unassigned || r.user_missing;

  return (
    <Link
      href={`/admin/reservations/${r.id}`}
      className={`group flex items-center gap-4 rounded-xl border px-4 py-3 transition-colors hover:border-gray-300 hover:bg-black/[0.02] ${
        needsAttention ? 'border-amber-300' : 'border-gray-200'
      }`}
    >
      {r.listing_image ? (
        <Image
          src={r.listing_image}
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="h-12 w-12 shrink-0 rounded-lg bg-gray-100" />
      )}

      {/* Guitar + customer */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-[#020E1C]">{r.listing_title}</p>
        <p className="truncate text-sm text-gray-500">
          {r.is_unassigned ? (
            <span className="text-amber-700">Unassigned — needs a customer</span>
          ) : r.user_missing ? (
            <span className="text-red-700">Account missing</span>
          ) : (
            <>
              {r.user_name}
              {r.user_email && <span className="text-gray-400"> · {r.user_email}</span>}
            </>
          )}
        </p>
      </div>

      {/* Badges */}
      <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClasses(r.status)}`}
        >
          {r.status_label}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs ${typeBadgeClasses(r.type)}`}>
          {r.type_label}
        </span>
      </div>

      {/* Money */}
      <div className="hidden shrink-0 text-right md:block">
        <p className="font-medium tabular-nums text-[#020E1C]">
          {formatCurrency(r.balance_due)}
        </p>
        <p className="text-xs text-gray-500">
          {r.deposit_paid_amount > 0 ? (
            <span className="text-green-700">
              {formatCurrency(r.deposit_paid_amount)} deposit paid
            </span>
          ) : r.deposit_required ? (
            <span className="text-amber-700">
              {formatCurrency(r.deposit_amount)} deposit due
            </span>
          ) : (
            'No deposit'
          )}
        </p>
      </div>

      {/* Expiry */}
      <div className="hidden w-24 shrink-0 text-right lg:block">
        <p className={`text-sm ${urgent ? 'font-medium text-red-600' : 'text-gray-600'}`}>
          {relativeExpiry(r.expires_at)}
        </p>
        {r.expires_at && (
          <p className="text-xs text-gray-400">
            {new Date(r.expires_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </p>
        )}
      </div>

      <ChevronRight className="h-5 w-5 shrink-0 text-gray-300 transition-colors group-hover:text-gray-500" />
    </Link>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        highlight ? 'border-red-200 bg-red-50' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        {icon}
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          highlight ? 'text-red-700' : 'text-[#020E1C]'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
