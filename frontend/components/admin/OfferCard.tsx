'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Check, X, DollarSign, MessageSquare } from 'lucide-react';
import api from '@/lib/api';

export interface AdminOffer {
  id: string;
  listingId: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  initialOfferAmount: number;
  currentOfferAmount: number;
  counterOfferAmount: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  listingTitle: string;
  listingPrice: number;
  listingCurrency: string;
  listingImage: string | null;
  listingDisabled: boolean;
}

interface OfferCardProps {
  offer: AdminOffer;
  onUpdate: (offerId: string, updatedOffer: AdminOffer | null) => void;
}

function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Pending</span>;
    case 'countered':
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Countered</span>;
    case 'accepted':
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Accepted</span>;
    case 'rejected':
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Rejected</span>;
    default:
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
  }
}

export function OfferCard({ offer, onUpdate }: OfferCardProps) {
  const [isCountering, setIsCountering] = useState(false);
  const [counterAmount, setCounterAmount] = useState('');
  const [isLoading, setIsLoading] = useState<'counter' | 'accept' | 'reject' | null>(null);
  const [error, setError] = useState('');

  const isPending = offer.status === 'pending' || offer.status === 'countered';

  const handleCounter = async () => {
    const amount = parseFloat(counterAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setError('');
    setIsLoading('counter');

    try {
      await api.authPut(`/admin/offers/${offer.id}/counter`, {
        counterAmount: amount,
      });

      onUpdate(offer.id, {
        ...offer,
        counterOfferAmount: amount,
        status: 'countered',
        updatedAt: new Date().toISOString(),
      });
      setIsCountering(false);
      setCounterAmount('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to counter offer');
    } finally {
      setIsLoading(null);
    }
  };

  const handleAccept = async () => {
    setError('');
    setIsLoading('accept');

    try {
      await api.authPut(`/admin/offers/${offer.id}/accept`);

      onUpdate(offer.id, {
        ...offer,
        status: 'accepted',
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept offer');
    } finally {
      setIsLoading(null);
    }
  };

  const handleReject = async () => {
    setError('');
    setIsLoading('reject');

    try {
      await api.authPut(`/admin/offers/${offer.id}/reject`);

      onUpdate(offer.id, {
        ...offer,
        status: 'rejected',
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject offer');
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className={`border rounded-lg p-4 ${offer.listingDisabled ? 'bg-gray-50 opacity-75' : 'bg-white'}`}>
      {/* Header with listing info */}
      <div className="flex gap-4">
        {offer.listingImage ? (
          <Image
            src={offer.listingImage}
            alt={offer.listingTitle}
            width={80}
            height={80}
            className="rounded object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-20 h-20 bg-gray-200 rounded flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 line-clamp-2 text-sm">{offer.listingTitle}</h3>
          <p className="text-sm text-gray-500">
            Listed: {formatPrice(offer.listingPrice, offer.listingCurrency)}
          </p>
          {offer.listingDisabled && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 mt-1">
              Listing Disabled
            </span>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          {getStatusBadge(offer.status)}
        </div>
      </div>

      {/* Offer details */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between text-sm">
          <div>
            <span className="text-gray-500">From:</span>{' '}
            <span className="font-medium text-gray-900">{offer.buyerName}</span>
            {offer.buyerEmail && (
              <span className="text-gray-400 ml-1">({offer.buyerEmail})</span>
            )}
          </div>
          <div className="text-gray-400 text-xs">
            {formatDate(offer.updatedAt)}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded p-3">
            <div className="text-xs text-gray-500 mb-1">Buyer&apos;s Offer</div>
            <div className="font-semibold text-lg text-gray-900">
              {formatPrice(offer.currentOfferAmount, offer.listingCurrency)}
            </div>
            {offer.initialOfferAmount !== offer.currentOfferAmount && (
              <div className="text-xs text-gray-400 line-through">
                Initial: {formatPrice(offer.initialOfferAmount, offer.listingCurrency)}
              </div>
            )}
          </div>
          {offer.counterOfferAmount && (
            <div className="bg-blue-50 rounded p-3">
              <div className="text-xs text-blue-600 mb-1">Your Counter</div>
              <div className="font-semibold text-lg text-blue-900">
                {formatPrice(offer.counterOfferAmount, offer.listingCurrency)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-3 p-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
          {error}
        </div>
      )}

      {/* Actions */}
      {isPending && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          {isCountering ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">$</span>
                <Input
                  type="number"
                  placeholder="Enter counter amount"
                  value={counterAmount}
                  onChange={(e) => setCounterAmount(e.target.value)}
                  className="flex-1"
                  min="1"
                  step="1"
                  disabled={isLoading !== null}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setIsCountering(false);
                    setCounterAmount('');
                    setError('');
                  }}
                  disabled={isLoading !== null}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={handleCounter}
                  disabled={isLoading !== null || !counterAmount}
                >
                  {isLoading === 'counter' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <MessageSquare className="h-4 w-4 mr-1" />
                      Send Counter
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setIsCountering(true)}
                disabled={isLoading !== null}
              >
                <DollarSign className="h-4 w-4 mr-1" />
                Counter
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleAccept}
                disabled={isLoading !== null}
              >
                {isLoading === 'accept' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Accept
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                onClick={handleReject}
                disabled={isLoading !== null}
              >
                {isLoading === 'reject' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <X className="h-4 w-4 mr-1" />
                    Reject
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
