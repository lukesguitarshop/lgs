'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertTriangle } from 'lucide-react';
import { cancelReservation, markReservationDepositPaid } from '@/lib/api';
import {
  CANCELLATION_REASON_OPTIONS,
  formatCurrency,
  type AdminReservation,
} from '@/lib/types/reservation';

function errorMessage(err: unknown, fallback: string): string {
  return err && typeof err === 'object' && 'message' in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

// ---------------- Cancel ----------------

interface CancelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: (reservation: AdminReservation) => void;
  reservation: AdminReservation | null;
}

/**
 * Cancelling a reservation that took money requires an explicit acknowledgement
 * that the refund is manual — the server refuses without it.
 */
export function CancelReservationDialog({
  isOpen,
  onClose,
  onDone,
  reservation,
}: CancelDialogProps) {
  const [reason, setReason] = useState<string>('customer_backed_out');
  const [note, setNote] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasDeposit = (reservation?.deposit_paid_amount ?? 0) > 0;

  useEffect(() => {
    if (!isOpen) return;
    setReason('customer_backed_out');
    setNote('');
    setAcknowledged(false);
    setError(null);
  }, [isOpen]);

  const handleCancel = async () => {
    if (!reservation) return;
    if (hasDeposit && !acknowledged) {
      setError('Tick the acknowledgement to continue.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await cancelReservation(reservation.id, reason, note || null, acknowledged);
      onDone(updated);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Could not cancel this reservation.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel reservation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {reservation && (
            <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {reservation.listing_title}
              {reservation.user_name && (
                <span className="text-gray-500"> · {reservation.user_name}</span>
              )}
            </div>
          )}

          {hasDeposit && (
            <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3">
              <div className="flex items-start gap-2 text-sm text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  A <strong>{formatCurrency(reservation!.deposit_paid_amount)}</strong> deposit
                  was paid on this reservation. Cancelling does <strong>NOT</strong> automatically
                  refund it — you&apos;ll need to issue the refund manually in{' '}
                  {reservation!.deposit_payment_method === 'paypal' ? 'PayPal' : 'Stripe'}.
                </p>
              </div>
              <label className="flex cursor-pointer items-start gap-2 text-sm text-red-900">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-red-300"
                />
                <span>I understand the refund must be issued manually.</span>
              </label>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="cancelReason">Reason</Label>
            <select
              id="cancelReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-[#FFFFF3] px-3 py-2 text-sm"
            >
              {CANCELLATION_REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cancelNote">Note (optional)</Label>
            <Textarea
              id="cancelNote"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <p className="text-xs text-gray-500">
            The listing goes back to available, the customer&apos;s locked cart item is
            removed, and they&apos;re emailed a plain cancellation notice.
          </p>

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Keep it
          </Button>
          <Button
            onClick={handleCancel}
            disabled={saving || (hasDeposit && !acknowledged)}
            className="bg-red-600 hover:bg-red-700"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cancel reservation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Manual deposit ----------------

interface MarkDepositDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: (reservation: AdminReservation) => void;
  reservation: AdminReservation | null;
}

/**
 * Records a deposit taken in cash, Venmo, Zelle or in person. Triggers exactly the
 * same lock-into-cart behaviour as an online deposit.
 */
export function MarkDepositPaidDialog({
  isOpen,
  onClose,
  onDone,
  reservation,
}: MarkDepositDialogProps) {
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [method, setMethod] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setAmount(reservation?.deposit_amount ? String(reservation.deposit_amount) : '');
    setPaidAt(new Date().toISOString().slice(0, 10));
    setMethod('');
    setError(null);
  }, [isOpen, reservation]);

  const handleSave = async () => {
    if (!reservation) return;

    const amountNum = parseFloat(amount) || 0;
    if (amountNum <= 0) {
      setError('Enter the amount received.');
      return;
    }
    if (!method.trim()) {
      setError('Enter how it was paid (cash, Venmo, Zelle…).');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await markReservationDepositPaid(
        reservation.id,
        amountNum,
        paidAt ? new Date(`${paidAt}T12:00:00`).toISOString() : null,
        method.trim()
      );
      onDone(updated);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Could not record this deposit.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark deposit paid</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {reservation && (
            <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {reservation.listing_title}
              {reservation.user_name && (
                <span className="text-gray-500"> · {reservation.user_name}</span>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="depositAmountManual">Amount received</Label>
            <Input
              id="depositAmountManual"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="depositPaidAt">Date received</Label>
            <Input
              id="depositPaidAt"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="depositMethod">How was it paid?</Label>
            <Input
              id="depositMethod"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              placeholder="Cash, Venmo, Zelle, in person…"
            />
          </div>

          <p className="text-xs text-gray-500">
            This locks the guitar into their cart and emails a receipt, exactly as an
            online deposit would.
          </p>

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record deposit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
