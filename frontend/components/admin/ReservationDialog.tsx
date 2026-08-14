'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { UserPicker } from './UserPicker';
import { createReservation, updateReservation } from '@/lib/api';
import {
  RESERVATION_TYPE_OPTIONS,
  defaultExpiryDays,
  formatCurrency,
  type AdminReservation,
  type ReservationType,
} from '@/lib/types/reservation';

interface ReservationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (reservation: AdminReservation) => void;
  /** Editing an existing reservation. */
  reservation?: AdminReservation | null;
  /** Creating a new one for this listing. */
  listing?: { id: string; title: string; price: number } | null;
}

/** Formats a Date for an <input type="date">. */
function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function ReservationDialog({
  isOpen,
  onClose,
  onSaved,
  reservation,
  listing,
}: ReservationDialogProps) {
  const isEdit = !!reservation;

  const [type, setType] = useState<ReservationType>('hold');
  const [userId, setUserId] = useState<string | null>(null);
  const [agreedPrice, setAgreedPrice] = useState('');
  const [tradeInCredit, setTradeInCredit] = useState('0');
  const [depositRequired, setDepositRequired] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositRefundable, setDepositRefundable] = useState(false);
  const [noExpiration, setNoExpiration] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [internalNote, setInternalNote] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceNum = parseFloat(agreedPrice) || 0;
  const creditNum = type === 'trade_in' ? parseFloat(tradeInCredit) || 0 : 0;
  const depositNum = parseFloat(depositAmount) || 0;

  // What they'd still owe once the deposit lands. Mirrors the server's
  // agreed price - deposit - trade-in credit, floored at zero.
  const balanceAfterDeposit = useMemo(
    () => Math.max(0, priceNum - creditNum - (depositRequired ? depositNum : 0)),
    [priceNum, creditNum, depositRequired, depositNum]
  );

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (!isOpen) return;
    setError(null);

    if (reservation) {
      setType(reservation.type === 'offer_accepted' ? 'hold' : reservation.type);
      setUserId(reservation.user_id);
      setAgreedPrice(String(reservation.agreed_price));
      setTradeInCredit(String(reservation.trade_in_credit));
      setDepositRequired(reservation.deposit_required);
      setDepositAmount(reservation.deposit_amount ? String(reservation.deposit_amount) : '');
      setDepositRefundable(reservation.deposit_refundable);
      setNoExpiration(!reservation.expires_at);
      setExpiresAt(reservation.expires_at ? toDateInput(new Date(reservation.expires_at)) : '');
      setInternalNote(reservation.internal_note || '');
    } else {
      const initialType: ReservationType = 'hold';
      setType(initialType);
      setUserId(null);
      setAgreedPrice(listing ? String(listing.price) : '');
      setTradeInCredit('0');
      setDepositRequired(false);
      setDepositAmount('');
      setDepositRefundable(false);
      setNoExpiration(false);
      setExpiresAt(
        toDateInput(new Date(Date.now() + defaultExpiryDays(initialType) * 864e5))
      );
      setInternalNote('');
    }
  }, [isOpen, reservation, listing]);

  // Changing type moves the default expiry (Hold 7 days, Trade-In 30) unless the
  // admin has already opted out of expiry.
  const handleTypeChange = (next: ReservationType) => {
    setType(next);
    if (!noExpiration && !isEdit) {
      setExpiresAt(toDateInput(new Date(Date.now() + defaultExpiryDays(next) * 864e5)));
    }
    if (next !== 'trade_in') setTradeInCredit('0');
  };

  /** Quick-pick deposit buttons. */
  const applyDepositPreset = (preset: '10%' | '20%' | '100' | '250') => {
    if (preset === '10%') setDepositAmount(String(Math.round(priceNum * 0.1)));
    else if (preset === '20%') setDepositAmount(String(Math.round(priceNum * 0.2)));
    else setDepositAmount(preset);
  };

  const validate = (): string | null => {
    if (!isEdit && !userId) return 'Pick the customer this is reserved for.';
    if (priceNum <= 0) return 'Agreed price must be greater than $0.';
    if (creditNum < 0) return 'Trade-in credit cannot be negative.';
    if (creditNum > priceNum) return 'Trade-in credit cannot exceed the agreed price.';
    if (depositRequired) {
      if (depositNum <= 0) return 'Deposit amount must be greater than $0.';
      if (depositNum > priceNum - creditNum) {
        return 'Deposit cannot exceed the agreed price minus trade-in credit.';
      }
    }
    if (!noExpiration && !expiresAt) return 'Pick an expiration date, or choose no expiration.';
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Expire at end of the chosen day rather than midnight at its start.
      const expiryIso = noExpiration
        ? null
        : new Date(`${expiresAt}T23:59:59`).toISOString();

      let saved: AdminReservation;

      if (isEdit && reservation) {
        saved = await updateReservation(reservation.id, {
          userId: userId || undefined,
          agreedPrice: priceNum,
          tradeInCredit: creditNum,
          depositRequired,
          depositAmount: depositRequired ? depositNum : 0,
          depositRefundable,
          expiresAt: expiryIso,
          noExpiration,
          internalNote: internalNote || null,
        });
      } else {
        saved = await createReservation({
          listingId: listing!.id,
          userId: userId!,
          type,
          agreedPrice: priceNum,
          tradeInCredit: creditNum,
          depositRequired,
          depositAmount: depositRequired ? depositNum : 0,
          depositRefundable,
          expiresAt: expiryIso,
          noExpiration,
          internalNote: internalNote || null,
        });
      }

      onSaved(saved);
      onClose();
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Could not save the reservation.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit reservation' : 'Mark as pending'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {(listing || reservation) && (
            <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {listing?.title || reservation?.listing_title}
            </div>
          )}

          {/* Type — only selectable on create; an accepted offer keeps its own type. */}
          {!isEdit && (
            <div className="space-y-1.5">
              <Label>Type</Label>
              <div className="flex gap-2">
                {RESERVATION_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleTypeChange(opt.value)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                      type === opt.value
                        ? 'border-[#6E0114] bg-[#6E0114] text-white'
                        : 'border-gray-300 bg-[#FFFFF3] text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Reserved for</Label>
            <UserPicker
              value={userId}
              onChange={(id) => setUserId(id)}
              initialUser={
                reservation && reservation.user_id
                  ? {
                      id: reservation.user_id,
                      name: reservation.user_name,
                      email: reservation.user_email,
                    }
                  : null
              }
            />
            {isEdit && reservation?.is_unassigned && (
              <p className="text-xs text-amber-700">
                This reservation is unassigned and blocks checkout for everyone until you
                pick a customer.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agreedPrice">Agreed price</Label>
            <Input
              id="agreedPrice"
              type="number"
              min="0"
              step="0.01"
              value={agreedPrice}
              onChange={(e) => setAgreedPrice(e.target.value)}
            />
          </div>

          {(type === 'trade_in' || reservation?.type === 'trade_in') && (
            <div className="space-y-1.5">
              <Label htmlFor="tradeInCredit">Trade-in credit</Label>
              <Input
                id="tradeInCredit"
                type="number"
                min="0"
                step="0.01"
                value={tradeInCredit}
                onChange={(e) => setTradeInCredit(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Subtracted from what they owe.
              </p>
            </div>
          )}

          {/* Deposit */}
          <div className="space-y-2 rounded-md border border-gray-200 p-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={depositRequired}
                onChange={(e) => {
                  const on = e.target.checked;
                  setDepositRequired(on);
                  if (on && !depositAmount && priceNum > 0) {
                    setDepositAmount(String(Math.round(priceNum * 0.1)));
                  }
                }}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm font-medium">Require a deposit</span>
            </label>

            {depositRequired && (
              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap gap-1.5">
                  {(['10%', '20%', '100', '250'] as const).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applyDepositPreset(preset)}
                      className="rounded border border-gray-300 bg-[#FFFFF3] px-2.5 py-1 text-xs hover:bg-gray-50"
                    >
                      {preset.endsWith('%') ? preset : `$${preset}`}
                    </button>
                  ))}
                </div>

                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Custom amount"
                />

                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={depositRefundable}
                    onChange={(e) => setDepositRefundable(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm">Refundable</span>
                </label>
                <p className="text-xs text-gray-500">
                  {depositRefundable
                    ? 'Shown to the customer as refundable. Refunds are still issued by hand.'
                    : 'Shown to the customer as non-refundable.'}
                </p>
              </div>
            )}
          </div>

          {/* Expiration */}
          <div className="space-y-2">
            <Label>Expires</Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={expiresAt}
                disabled={noExpiration}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="flex-1"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={noExpiration}
                onChange={(e) => setNoExpiration(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm">No expiration</span>
            </label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="internalNote">Internal note</Label>
            <Textarea
              id="internalNote"
              rows={2}
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              placeholder="Admin only — never shown to the customer"
            />
          </div>

          {/* Live summary of what the customer will owe. */}
          <div className="rounded-md bg-gray-50 px-3 py-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Agreed price</span>
              <span>{formatCurrency(priceNum)}</span>
            </div>
            {creditNum > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Trade-in credit</span>
                <span>-{formatCurrency(creditNum)}</span>
              </div>
            )}
            {depositRequired && depositNum > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Deposit to secure</span>
                <span>{formatCurrency(depositNum)}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between border-t border-gray-200 pt-1 font-medium text-gray-900">
              <span>Balance due</span>
              <span>{formatCurrency(balanceAfterDeposit)}</span>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Mark as pending'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
