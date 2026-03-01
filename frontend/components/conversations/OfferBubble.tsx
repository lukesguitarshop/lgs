'use client';

import { Button } from '@/components/ui/button';
import { ConversationEvent, formatTimeRemaining } from '@/lib/conversations';
import { CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react';

interface OfferBubbleProps {
  event: ConversationEvent;
  isMyTurn: boolean;
  pendingExpiresAt: string | null;
  conversationStatus: string;
  onAccept: () => void;
  onDecline: () => void;
  onCounter: (amount: number) => void;
  isLoading: boolean;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function OfferBubble({
  event,
  isMyTurn,
  pendingExpiresAt,
  conversationStatus,
  onAccept,
  onDecline,
  onCounter,
  isLoading,
}: OfferBubbleProps) {
  const isActive = conversationStatus === 'active';
  const showActions = isMyTurn && isActive && !event.isFromMe;

  // Determine bubble styling based on who sent it and the event type
  const isFromMe = event.isFromMe;
  const bubbleClasses = isFromMe
    ? 'ml-auto bg-[#df5e15] text-white'
    : 'mr-auto bg-muted';

  if (event.type === 'accept') {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-green-100 border border-green-300 rounded-lg px-4 py-2 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-green-800 font-medium">
            Offer of {formatPrice(event.offerAmount!)} accepted
          </span>
        </div>
      </div>
    );
  }

  if (event.type === 'decline') {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-red-100 border border-red-300 rounded-lg px-4 py-2 flex items-center gap-2">
          <XCircle className="h-5 w-5 text-red-600" />
          <span className="text-red-800 font-medium">
            Offer declined
            {event.messageText && `: ${event.messageText}`}
          </span>
        </div>
      </div>
    );
  }

  if (event.type === 'expire') {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-gray-100 border border-gray-300 rounded-lg px-4 py-2 flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-600" />
          <span className="text-gray-800 font-medium">
            {event.messageText || 'Offer expired'}
          </span>
        </div>
      </div>
    );
  }

  if (event.type === 'offer') {
    return (
      <div className={`flex flex-col max-w-[80%] ${isFromMe ? 'items-end ml-auto' : 'items-start mr-auto'}`}>
        <div className={`rounded-lg p-4 ${bubbleClasses}`}>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-5 w-5" />
            <span className="text-2xl font-bold">{formatPrice(event.offerAmount!)}</span>
          </div>
          <p className="text-sm opacity-90">
            {isFromMe ? 'You offered' : 'Offered'}
          </p>
        </div>
        <span className="text-xs text-muted-foreground mt-1">{formatTime(event.createdAt)}</span>

        {showActions && (
          <div className="flex flex-col gap-2 mt-3 w-full">
            {pendingExpiresAt && (
              <p className="text-xs text-muted-foreground">
                {formatTimeRemaining(pendingExpiresAt)}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                onClick={onAccept}
                disabled={isLoading}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Accept
              </Button>
              <Button
                onClick={onDecline}
                disabled={isLoading}
                variant="outline"
                className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Decline
              </Button>
            </div>
            <Button
              onClick={() => {
                const amount = prompt('Enter counter offer amount:');
                if (amount && !isNaN(parseFloat(amount))) {
                  onCounter(parseFloat(amount));
                }
              }}
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              Counter Offer
            </Button>
          </div>
        )}

        {!isActive && !isFromMe && event.type === 'offer' && (
          <div className="mt-2 text-xs text-muted-foreground italic">
            {conversationStatus === 'accepted' && 'This offer was accepted'}
            {conversationStatus === 'declined' && 'This conversation was declined'}
            {conversationStatus === 'expired' && 'This offer expired'}
          </div>
        )}
      </div>
    );
  }

  // Regular message
  return (
    <div className={`flex flex-col max-w-[80%] ${isFromMe ? 'items-end ml-auto' : 'items-start mr-auto'}`}>
      <div className={`rounded-lg px-4 py-2 ${bubbleClasses}`}>
        <p>{event.messageText}</p>
      </div>
      <span className="text-xs text-muted-foreground mt-1">{formatTime(event.createdAt)}</span>
    </div>
  );
}
