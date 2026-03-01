'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Conversation, formatTimeRemaining } from '@/lib/conversations';

interface ConversationCardProps {
  conversation: Conversation;
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
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getStatusBadge(conversation: Conversation) {
  switch (conversation.status) {
    case 'active':
      if (conversation.isMyTurn) {
        return (
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
            <AlertCircle className="h-3 w-3 mr-1" />
            Your Turn
          </Badge>
        );
      }
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
          <Clock className="h-3 w-3 mr-1" />
          Waiting
        </Badge>
      );
    case 'accepted':
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Accepted
        </Badge>
      );
    case 'declined':
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <XCircle className="h-3 w-3 mr-1" />
          Declined
        </Badge>
      );
    case 'expired':
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
          <Clock className="h-3 w-3 mr-1" />
          Expired
        </Badge>
      );
    default:
      return <Badge variant="outline">{conversation.status}</Badge>;
  }
}

export function ConversationCard({ conversation }: ConversationCardProps) {
  const listing = conversation.listing;
  const lastOffer = conversation.events
    .filter(e => e.type === 'offer')
    .pop();

  return (
    <Link href={`/conversations/${conversation.id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col cursor-pointer">
        <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-muted to-muted/50">
          {listing?.image ? (
            <Image
              src={listing.image}
              alt={listing.listingTitle}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <span className="text-6xl">🎸</span>
            </div>
          )}
          {listing?.disabled && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white font-semibold">SOLD</span>
            </div>
          )}
        </div>
        <CardContent className="flex flex-col flex-1 p-4">
          <div className="flex justify-between items-start mb-2">
            {getStatusBadge(conversation)}
            <span className="text-xs text-muted-foreground">{formatDate(conversation.updatedAt)}</span>
          </div>

          {listing && (
            <h3 className="font-semibold text-lg mb-2 line-clamp-2 hover:text-[#df5e15] transition-colors">
              {listing.listingTitle}
            </h3>
          )}

          <div className="space-y-1 mb-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">List Price:</span>
              <span className="font-medium">
                {listing ? formatPrice(listing.price, listing.currency) : 'N/A'}
              </span>
            </div>
            {lastOffer && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last Offer:</span>
                <span className="font-bold text-[#df5e15]">
                  {formatPrice(lastOffer.offerAmount!)}
                </span>
              </div>
            )}
            {conversation.acceptedAmount && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Agreed Price:</span>
                <span className="font-bold text-green-600">
                  {formatPrice(conversation.acceptedAmount)}
                </span>
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground mb-2">
            {conversation.iAmBuyer ? `Seller: ${conversation.sellerName}` : `Buyer: ${conversation.buyerName}`}
          </div>

          {conversation.status === 'active' && conversation.pendingExpiresAt && (
            <div className="mt-auto pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                {formatTimeRemaining(conversation.pendingExpiresAt)}
              </p>
            </div>
          )}

          {conversation.isMyTurn && conversation.status === 'active' && (
            <div className="mt-2 bg-orange-50 border border-orange-200 rounded-md p-2">
              <p className="text-sm text-orange-700">
                Action required - respond to this offer
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
