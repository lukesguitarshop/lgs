'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { AdminTabsNav } from '@/components/admin/AdminTabsNav';
import { ReservationDialog } from '@/components/admin/ReservationDialog';
import {
  CancelReservationDialog,
  MarkDepositPaidDialog,
} from '@/components/admin/ReservationActionDialogs';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  AlertTriangle,
  Clock,
  DollarSign,
  Bookmark,
  UserX,
} from 'lucide-react';
import {
  getAdminReservations,
  getReservationSummary,
  extendReservation,
  convertReservationToSale,
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

export default function ReservationsPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();

  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [summary, setSummary] = useState<ReservationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters. Active-only is on by default so the list shows what's live.
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);

  const [editing, setEditing] = useState<AdminReservation | null>(null);
  const [cancelling, setCancelling] = useState<AdminReservation | null>(null);
  const [depositing, setDepositing] = useState<AdminReservation | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
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
    if (isAdmin) load();
  }, [isAdmin, load]);

  const replaceRow = (updated: AdminReservation) => {
    setReservations((prev) => {
      const next = prev.map((r) => (r.id === updated.id ? updated : r));
      // Drop rows that no longer match the active-only filter.
      return activeOnly && !statusFilter
        ? next.filter((r) => r.status === 'pending' || r.status === 'deposit_paid')
        : next;
    });
    getReservationSummary().then(setSummary).catch(() => {});
  };

  const handleExtend = async (reservation: AdminReservation, days: number) => {
    setBusyId(reservation.id);
    try {
      const updated = await extendReservation(reservation.id, days);
      replaceRow(updated);
    } catch (err) {
      setError(
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Could not extend this hold.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleConvert = async (reservation: AdminReservation) => {
    if (
      !confirm(
        `Mark "${reservation.listing_title}" as sold in person? This completes the reservation and removes the listing from inventory.`
      )
    ) {
      return;
    }
    setBusyId(reservation.id);
    try {
      const updated = await convertReservationToSale(reservation.id);
      replaceRow(updated);
    } catch (err) {
      setError(
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Could not convert this reservation.'
      );
    } finally {
      setBusyId(null);
    }
  };

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

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#6E0114]" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Admin access required</h1>
        <Link href="/" className="mt-4 inline-block text-[#6E0114] underline">
          Back to the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <AdminTabsNav />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-nav text-2xl text-[#020E1C]">Reservations</h1>
        <Button variant="outline" onClick={handleMigrate} disabled={migrating}>
          {migrating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Migrate legacy pending listings
        </Button>
      </div>

      {migrationResult && (
        <div className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
          {migrationResult}
        </div>
      )}

      {/* Dashboard counters */}
      {summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          className="rounded-md border border-gray-300 bg-[#FFFFF3] px-3 py-1.5 text-sm"
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
          className="rounded-md border border-gray-300 bg-[#FFFFF3] px-3 py-1.5 text-sm"
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
        <div className="mb-4 flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#6E0114]" />
        </div>
      ) : reservations.length === 0 ? (
        <div className="rounded-md border border-gray-200 bg-[#FFFFF3] py-16 text-center text-gray-500">
          No reservations match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-200 bg-[#FFFFF3]">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Guitar</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Reserved for</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Agreed</th>
                <th className="px-3 py-2 text-right">Deposit</th>
                <th className="px-3 py-2 text-right">Balance</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Expires</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reservations.map((r) => (
                <tr key={r.id} className="align-top hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <Link
                      href={`/listing/${r.listing_id}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      {r.listing_image ? (
                        <Image
                          src={r.listing_image}
                          alt=""
                          width={40}
                          height={40}
                          className="h-10 w-10 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 shrink-0 rounded bg-gray-100" />
                      )}
                      <span className="line-clamp-2 max-w-[200px]">{r.listing_title}</span>
                    </Link>
                  </td>

                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs ${typeBadgeClasses(r.type)}`}
                    >
                      {r.type_label}
                    </span>
                  </td>

                  <td className="px-3 py-2">
                    {r.is_unassigned ? (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        <AlertTriangle className="h-3 w-3" />
                        Unassigned — needs user
                      </span>
                    ) : r.user_missing ? (
                      <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">
                        <UserX className="h-3 w-3" />
                        Account missing
                      </span>
                    ) : (
                      <div>
                        <div className="font-medium text-gray-900">{r.user_name}</div>
                        <div className="text-xs text-gray-500">{r.user_email}</div>
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs ${statusBadgeClasses(r.status)}`}
                    >
                      {r.status_label}
                    </span>
                    {r.needs_review && (
                      <div
                        className="mt-1 text-xs text-red-700"
                        title={r.needs_review_reason || undefined}
                      >
                        Needs review
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(r.agreed_price)}
                    {r.trade_in_credit > 0 && (
                      <div className="text-xs text-gray-500">
                        -{formatCurrency(r.trade_in_credit)} trade
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.deposit_paid_amount > 0 ? (
                      <div>
                        <div className="text-green-700">
                          {formatCurrency(r.deposit_paid_amount)}
                        </div>
                        <div className="text-xs text-gray-500">paid</div>
                      </div>
                    ) : r.deposit_required ? (
                      <div>
                        <div>{formatCurrency(r.deposit_amount)}</div>
                        <div className="text-xs text-amber-700">unpaid</div>
                      </div>
                    ) : (
                      <span className="text-gray-400">None</span>
                    )}
                  </td>

                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                    {formatCurrency(r.balance_due)}
                    {r.is_over_credited && (
                      <div className="text-xs text-red-700">over-credited</div>
                    )}
                  </td>

                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>

                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {r.expires_at ? (
                      <>
                        <div>{new Date(r.expires_at).toLocaleDateString()}</div>
                        <div
                          className={
                            isExpiringSoon(r.expires_at) || r.is_expired
                              ? 'font-medium text-red-600'
                              : 'text-gray-500'
                          }
                        >
                          {relativeExpiry(r.expires_at)}
                        </div>
                      </>
                    ) : (
                      <span className="text-gray-400">No expiration</span>
                    )}
                  </td>

                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <ActionButton onClick={() => setEditing(r)} disabled={busyId === r.id}>
                        Edit
                      </ActionButton>

                      {(r.status === 'pending' || r.status === 'deposit_paid' || r.status === 'expired') && (
                        <>
                          <ActionButton
                            onClick={() => handleExtend(r, 7)}
                            disabled={busyId === r.id}
                          >
                            +7d
                          </ActionButton>
                          <ActionButton
                            onClick={() => handleExtend(r, 14)}
                            disabled={busyId === r.id}
                          >
                            +14d
                          </ActionButton>
                          <ActionButton
                            onClick={() => handleExtend(r, 30)}
                            disabled={busyId === r.id}
                          >
                            +30d
                          </ActionButton>
                        </>
                      )}

                      {r.deposit_paid_amount === 0 && !r.is_unassigned && (
                        <ActionButton
                          onClick={() => setDepositing(r)}
                          disabled={busyId === r.id}
                        >
                          Deposit paid
                        </ActionButton>
                      )}

                      {(r.status === 'pending' || r.status === 'deposit_paid') && (
                        <ActionButton
                          onClick={() => handleConvert(r)}
                          disabled={busyId === r.id}
                        >
                          Convert to sale
                        </ActionButton>
                      )}

                      {(r.status === 'pending' || r.status === 'deposit_paid') && (
                        <ActionButton
                          onClick={() => setCancelling(r)}
                          disabled={busyId === r.id}
                          danger
                        >
                          Cancel
                        </ActionButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ReservationDialog
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        onSaved={replaceRow}
        reservation={editing}
      />
      <CancelReservationDialog
        isOpen={!!cancelling}
        onClose={() => setCancelling(null)}
        onDone={replaceRow}
        reservation={cancelling}
      />
      <MarkDepositPaidDialog
        isOpen={!!depositing}
        onClose={() => setDepositing(null)}
        onDone={replaceRow}
        reservation={depositing}
      />
    </div>
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
      className={`rounded-md border bg-[#FFFFF3] px-3 py-2 ${
        highlight ? 'border-red-200 bg-red-50' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        {icon}
        {label}
      </div>
      <div className={`mt-0.5 text-lg font-semibold ${highlight ? 'text-red-700' : 'text-gray-900'}`}>
        {value}
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded border px-2 py-0.5 text-xs transition-colors disabled:opacity-50 ${
        danger
          ? 'border-red-300 text-red-700 hover:bg-red-50'
          : 'border-gray-300 text-gray-700 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}
