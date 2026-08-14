'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReservationDialog } from '@/components/admin/ReservationDialog';
import {
  CancelReservationDialog,
  MarkDepositPaidDialog,
} from '@/components/admin/ReservationActionDialogs';
import {
  ArrowLeft,
  Loader2,
  Bookmark,
  User,
  Calendar,
  Clock,
  Receipt,
  Copy,
  Check,
  Mail,
  AlertTriangle,
  ExternalLink,
  Guitar,
} from 'lucide-react';
import { api, extendReservation, convertReservationToSale } from '@/lib/api';
import {
  statusBadgeClasses,
  typeBadgeClasses,
  relativeExpiry,
  isExpiringSoon,
  formatCurrency,
  type AdminReservation,
} from '@/lib/types/reservation';

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatShortDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { isAdmin, isLoading: authLoading } = useAuth();

  const [reservation, setReservation] = useState<AdminReservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [depositing, setDepositing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.authGet<AdminReservation>(`/admin/reservations/${id}`);
      setReservation(data);
    } catch (err) {
      setError(
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Could not load this reservation.'
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const runAction = async (fn: () => Promise<AdminReservation>) => {
    setBusy(true);
    setError(null);
    try {
      setReservation(await fn());
    } catch (err) {
      setError(
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'That action failed.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleConvert = async () => {
    if (
      !reservation ||
      !confirm(
        `Mark "${reservation.listing_title}" as sold in person? This completes the reservation and removes the listing from inventory.`
      )
    ) {
      return;
    }
    await runAction(() => convertReservationToSale(reservation.id));
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#6E0114]" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Admin access required</h1>
      </div>
    );
  }

  if (error && !reservation) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <BackLink />
          <Card>
            <CardContent className="py-12 text-center">
              <Bookmark className="mx-auto mb-4 h-12 w-12 text-gray-300" />
              <p className="text-gray-500">{error}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!reservation) return null;

  const r = reservation;
  const isActive = r.status === 'pending' || r.status === 'deposit_paid';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <BackLink />
          <Link href={`/listing/${r.listing_id}`} target="_blank">
            <Button variant="outline">
              <ExternalLink className="mr-2 h-4 w-4" />
              View listing
            </Button>
          </Link>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Bookmark className="h-6 w-6" />
                  Reservation #{r.id.slice(-8).toUpperCase()}
                </CardTitle>
                <button
                  onClick={() => copyToClipboard(r.id, 'id')}
                  className="mt-2 flex items-center gap-1 font-mono text-sm text-gray-500 hover:text-gray-700"
                >
                  {r.id}
                  {copiedField === 'id' ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium ${typeBadgeClasses(r.type)}`}
                >
                  {r.type_label}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium ${statusBadgeClasses(r.status)}`}
                >
                  {r.status_label}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-gray-600">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Created {formatShortDate(r.created_at)}
              </span>
              <span
                className={`flex items-center gap-2 ${
                  r.is_expired || isExpiringSoon(r.expires_at) ? 'font-medium text-red-600' : ''
                }`}
              >
                <Clock className="h-4 w-4" />
                {r.expires_at
                  ? `Expires ${formatShortDate(r.expires_at)} (${relativeExpiry(r.expires_at)})`
                  : 'No expiration'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Needs-review banner */}
        {r.needs_review && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="flex items-start gap-2 py-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="font-medium text-red-900">Needs review</p>
                <p className="text-sm text-red-800">{r.needs_review_reason}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Guitar */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Guitar className="h-5 w-5" />
                Guitar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link href={`/listing/${r.listing_id}`} className="flex gap-3 hover:opacity-80">
                {r.listing_image ? (
                  <Image
                    src={r.listing_image}
                    alt=""
                    width={72}
                    height={72}
                    className="h-18 w-18 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="h-18 w-18 shrink-0 rounded bg-gray-100" />
                )}
                <div className="min-w-0">
                  <p className="font-medium leading-snug">{r.listing_title}</p>
                  {r.listing_price != null && (
                    <p className="mt-1 text-sm text-gray-500">
                      Current listing price {formatCurrency(r.listing_price)}
                    </p>
                  )}
                  {r.listing_sold && (
                    <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                      Sold / removed from inventory
                    </span>
                  )}
                </div>
              </Link>
            </CardContent>
          </Card>

          {/* Reserved for */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                Reserved for
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {r.is_unassigned ? (
                <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <p className="font-medium">Unassigned — needs a customer</p>
                  <p className="mt-0.5 text-xs">
                    This blocks checkout for everyone until you assign someone.
                  </p>
                </div>
              ) : r.user_missing ? (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                  <p className="font-medium">Account missing</p>
                  <p className="mt-0.5 text-xs">
                    The reserved account was deleted or disabled. The listing stays blocked.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="text-lg font-medium">{r.user_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{r.user_email}</p>
                      {r.user_email && (
                        <>
                          <button
                            onClick={() => copyToClipboard(r.user_email!, 'email')}
                            className="text-gray-400 hover:text-gray-600"
                            title="Copy email"
                          >
                            {copiedField === 'email' ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                          <a
                            href={`mailto:${r.user_email}`}
                            className="text-[#6E0114] hover:text-[#580110]"
                            title="Send email"
                          >
                            <Mail className="h-4 w-4" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                  {r.user_id && (
                    <Link
                      href={`/admin/user/${r.user_id}`}
                      className="inline-block text-sm text-[#6E0114] underline"
                    >
                      View customer
                    </Link>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Money */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Receipt className="h-5 w-5" />
              Terms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <Row label="Agreed price" value={formatCurrency(r.agreed_price)} />
              {r.trade_in_credit > 0 && (
                <Row label="Trade-in credit" value={`-${formatCurrency(r.trade_in_credit)}`} />
              )}
              {r.deposit_required && (
                <Row
                  label={`Deposit required${r.deposit_refundable ? ' (refundable)' : ' (non-refundable)'}`}
                  value={formatCurrency(r.deposit_amount)}
                />
              )}
              {r.deposit_paid_amount > 0 && (
                <Row
                  label={`Deposit paid${r.deposit_payment_method ? ` · ${r.deposit_payment_method}` : ''}`}
                  value={`-${formatCurrency(r.deposit_paid_amount)}`}
                  positive
                />
              )}
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <span>Balance due</span>
                <span className="tabular-nums">{formatCurrency(r.balance_due)}</span>
              </div>
              {r.is_over_credited && (
                <p className="text-xs text-red-700">
                  Credits exceed the agreed price. Balance floored at $0 — needs review.
                </p>
              )}
            </div>

            <p className="mt-4 text-xs text-gray-500">
              Terms are locked at creation. The balance is computed from these values, not
              from the live listing price.
            </p>

            {(r.deposit_order_id || r.final_order_id) && (
              <div className="mt-4 space-y-1 border-t pt-3 text-sm">
                {r.deposit_order_id && (
                  <Link
                    href={`/order/${r.deposit_order_id}`}
                    className="flex items-center gap-1 text-[#6E0114] underline"
                  >
                    Deposit order <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
                {r.final_order_id && (
                  <Link
                    href={`/order/${r.final_order_id}`}
                    className="flex items-center gap-1 text-[#6E0114] underline"
                  >
                    Final order <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Internal note */}
        {(r.internal_note || r.cancellation_reason) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Internal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {r.internal_note && (
                <div>
                  <p className="text-gray-500">Note (never shown to the customer)</p>
                  <p className="mt-0.5 whitespace-pre-wrap">{r.internal_note}</p>
                </div>
              )}
              {r.cancellation_reason && (
                <div>
                  <p className="text-gray-500">Cancellation reason</p>
                  <p className="mt-0.5">{r.cancellation_reason}</p>
                </div>
              )}
              {r.deposit_paid_at && (
                <div>
                  <p className="text-gray-500">Deposit received</p>
                  <p className="mt-0.5">{formatDate(r.deposit_paid_at)}</p>
                </div>
              )}
              {r.completed_at && (
                <div>
                  <p className="text-gray-500">Completed</p>
                  <p className="mt-0.5">{formatDate(r.completed_at)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditing(true)} disabled={busy}>
              Edit
            </Button>

            {(isActive || r.status === 'expired') && (
              <>
                {[7, 14, 30].map((days) => (
                  <Button
                    key={days}
                    variant="outline"
                    disabled={busy}
                    onClick={() => runAction(() => extendReservation(r.id, days))}
                  >
                    +{days} days
                  </Button>
                ))}
              </>
            )}

            {r.deposit_paid_amount === 0 && !r.is_unassigned && (
              <Button variant="outline" onClick={() => setDepositing(true)} disabled={busy}>
                Mark deposit paid
              </Button>
            )}

            {isActive && (
              <Button variant="outline" onClick={handleConvert} disabled={busy}>
                Convert to sale
              </Button>
            )}

            {isActive && (
              <Button
                onClick={() => setCancelling(true)}
                disabled={busy}
                className="bg-red-600 hover:bg-red-700"
              >
                Cancel reservation
              </Button>
            )}

            {busy && <Loader2 className="h-5 w-5 animate-spin self-center text-[#6E0114]" />}
          </CardContent>
        </Card>
      </div>

      <ReservationDialog
        isOpen={editing}
        onClose={() => setEditing(false)}
        onSaved={setReservation}
        reservation={r}
      />
      <CancelReservationDialog
        isOpen={cancelling}
        onClose={() => setCancelling(false)}
        onDone={setReservation}
        reservation={r}
      />
      <MarkDepositPaidDialog
        isOpen={depositing}
        onClose={() => setDepositing(false)}
        onDone={setReservation}
        reservation={r}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/admin/other-tools?tab=reservations">
      <Button variant="ghost">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to reservations
      </Button>
    </Link>
  );
}

function Row({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}</span>
      <span className={`tabular-nums ${positive ? 'text-green-700' : ''}`}>{value}</span>
    </div>
  );
}
