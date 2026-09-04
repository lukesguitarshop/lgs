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
import { StateBlock } from '@/components/ui/state-block';
import api from '@/lib/api';

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
  /** If provided, the modal will call this instead of making the API call */
  onOfferSubmit?: (amount: number) => Promise<void>;
  /** Whether this is a counter-offer in an existing conversation */
  isCounter?: boolean;
}

function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export function MakeOfferModal({ open, onOpenChange, listing, onSuccess, onOfferSubmit, isCounter }: MakeOfferModalProps) {
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
      // If a custom submit handler is provided, use it
      if (onOfferSubmit) {
        await onOfferSubmit(amount);
        setIsSuccess(true);
        // Close modal after short delay
        setTimeout(() => {
          handleClose(false);
          onSuccess?.();
        }, 1500);
      } else {
        // Create or find conversation, then make offer
        const conversation = await api.authPost<{ conversationId: string }>('/messages/contact-seller', {
          listingId: listing.id,
        });

        // Make offer on the conversation
        await api.authPost(`/messages/conversations/${conversation.conversationId}/offer`, {
          offerAmount: amount,
        });

        setIsSuccess(true);

        // Redirect to conversation after short delay to show success
        setTimeout(() => {
          window.location.href = `/messages/${conversation.conversationId}`;
        }, 1500);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '';
      if (errorMessage.toLowerCase().includes('active offer')) {
        setError('There is already an active offer in this conversation.');
      } else {
        setError(errorMessage || 'Failed to submit offer. Please try again.');
      }
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
          <DialogTitle>{isCounter ? 'Counter Offer' : 'Make an Offer'}</DialogTitle>
          <DialogDescription>
            {isCounter
              ? 'Submit your counter offer. The other party will review and respond.'
              : 'Submit your offer for this listing. The seller will review and respond.'}
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <StateBlock variant="success" label="Offer sent">
            Your offer of {formatPrice(parseFloat(offerAmount), listing.currency)} has been sent to the seller.
          </StateBlock>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            {/* Listing info */}
            <div className="p-3 bg-muted rounded-md">
              <p className="font-medium text-foreground text-sm line-clamp-2">{listing.title}</p>
              <p className="text-foreground/65 text-sm mt-1">
                Listed at: <span className="font-semibold text-foreground">{formatPrice(listing.price, listing.currency)}</span>
              </p>
            </div>

            {error && <StateBlock variant="error">{error}</StateBlock>}

            <div className="space-y-2">
              <Label htmlFor="offerAmount">Your Offer</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/60">$</span>
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
              <p className="text-[13px] text-foreground/65 md:text-xs">
                Enter the amount you&apos;d like to offer for this item.
              </p>
            </div>

            <div className="grid gap-2 pt-2 sm:flex sm:gap-3">
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
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
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
