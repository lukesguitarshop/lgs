'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';

interface MakeOfferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: {
    id: string;
    title: string;
    price: number;
    currency: string;
  };
  onSuccess?: () => void;
}

function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export function MakeOfferModal({ open, onOpenChange, listing, onSuccess }: MakeOfferModalProps) {
  const [offerAmount, setOfferAmount] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amount = parseFloat(offerAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid offer amount greater than $0');
      return;
    }

    if (amount > 99999) {
      setError('Offer amount cannot exceed $99,999');
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/offers', {
        listingId: listing.id,
        offerAmount: amount,
      }, {
        headers: getAuthHeaders(),
      });

      setIsSuccess(true);

      // Close modal after short delay to show success
      setTimeout(() => {
        setOfferAmount('');
        setIsSuccess(false);
        onOpenChange(false);
        onSuccess?.();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit offer. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = (newOpen: boolean) => {
    if (!isLoading) {
      setOfferAmount('');
      setError('');
      setIsSuccess(false);
      onOpenChange(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Make an Offer</DialogTitle>
          <DialogDescription>
            Submit your offer for this listing. The seller will review and respond.
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Offer Submitted!</h3>
            <p className="text-muted-foreground">
              Your offer of {formatPrice(parseFloat(offerAmount), listing.currency)} has been sent to the seller.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            {/* Listing info */}
            <div className="p-3 bg-muted rounded-md">
              <p className="font-medium text-foreground text-sm line-clamp-2">{listing.title}</p>
              <p className="text-muted-foreground text-sm mt-1">
                Listed at: <span className="font-semibold text-foreground">{formatPrice(listing.price, listing.currency)}</span>
              </p>
            </div>

            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="offerAmount">Your Offer</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="offerAmount"
                  type="number"
                  placeholder="0"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  className="pl-7"
                  min="1"
                  max="99999"
                  step="1"
                  required
                  disabled={isLoading}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the amount you&apos;d like to offer for this item.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => handleClose(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-[#df5e15] hover:bg-[#c74d12]"
                disabled={isLoading || !offerAmount}
              >
                {isLoading ? 'Submitting...' : 'Submit Offer'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
