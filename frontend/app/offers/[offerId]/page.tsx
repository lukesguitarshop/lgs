'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Tag, Clock, CheckCircle, XCircle, MessageSquare, User, Send, ShoppingCart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';
import { refreshPendingCart } from '@/lib/cart';

interface ListingSummary {
  id: string;
  listingTitle: string;
  price: number;
  currency: string;
  condition: string | null;
  image: string | null;
  disabled: boolean;
}

interface OfferMessage {
  senderId: string;
  messageText: string;
  createdAt: string;
  isSystemMessage: boolean;
}

interface Offer {
  id: string;
  listingId: string;
  buyerId: string;
  buyerName: string;
  initialOfferAmount: number;
  currentOfferAmount: number;
  counterOfferAmount: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  messages: OfferMessage[];
  listing: ListingSummary | null;
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
    year: 'numeric',
  });
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    case 'countered':
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><MessageSquare className="h-3 w-3 mr-1" />Countered</Badge>;
    case 'accepted':
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />Accepted</Badge>;
    case 'rejected':
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function OfferDetailPage() {
  const params = useParams();
  const router = useRouter();
  const offerId = params.offerId as string;
  const { isAuthenticated, isLoading: authLoading, user, setShowLoginModal } = useAuth();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    const fetchOffer = async () => {
      try {
        const data = await api.get<Offer>(`/offers/${offerId}`, {
          headers: getAuthHeaders(),
        });
        setOffer(data);

        // If offer is accepted and user is the buyer, refresh cart badge
        if (data.status === 'accepted' && user?.id === data.buyerId) {
          refreshPendingCart();
        }
      } catch (error: unknown) {
        console.error('Failed to fetch offer:', error);
        setError('Failed to load offer details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOffer();
  }, [isAuthenticated, authLoading, offerId, user?.id]);

  const handleAcceptCounter = async () => {
    if (!offer) return;
    setIsActioning(true);
    setError(null);

    try {
      const updated = await api.put<Offer>(`/offers/${offerId}/accept`, {}, {
        headers: getAuthHeaders(),
      });
      setOffer(updated);
    } catch (error: unknown) {
      console.error('Failed to accept counter offer:', error);
      setError('Failed to accept counter offer. Please try again.');
    } finally {
      setIsActioning(false);
    }
  };

  const handleReject = async () => {
    if (!offer) return;
    setIsActioning(true);
    setError(null);

    try {
      const updated = await api.put<Offer>(`/offers/${offerId}/reject`, {}, {
        headers: getAuthHeaders(),
      });
      setOffer(updated);
    } catch (error: unknown) {
      console.error('Failed to reject offer:', error);
      setError('Failed to reject offer. Please try again.');
    } finally {
      setIsActioning(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link
          href="/offers"
          className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to offers
        </Link>

        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <Tag className="h-16 w-16 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Sign in to view offer details</h2>
            <p className="text-muted-foreground">
              Create an account or sign in to view and manage your offers.
            </p>
            <Button
              onClick={() => setShowLoginModal(true)}
              className="bg-[#df5e15] hover:bg-[#c54d0a] text-white"
            >
              Sign In
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link
          href="/offers"
          className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to offers
        </Link>

        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <Tag className="h-16 w-16 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Offer not found</h2>
            <p className="text-muted-foreground">
              This offer may have been removed or you don't have permission to view it.
            </p>
            <Link href="/offers">
              <Button className="bg-[#df5e15] hover:bg-[#c54d0a] text-white">
                View My Offers
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const listing = offer.listing;
  const isBuyer = user?.id === offer.buyerId;
  const canRespond = offer.status === 'countered' && isBuyer;
  const isActive = offer.status === 'pending' || offer.status === 'countered';

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/offers"
        className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to offers
      </Link>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Offer Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Offer Header */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                <div>
                  <CardTitle className="text-2xl mb-2">Offer Details</CardTitle>
                  <p className="text-muted-foreground text-sm">
                    Submitted on {formatDate(offer.createdAt)} at {formatTime(offer.createdAt)}
                  </p>
                </div>
                {getStatusBadge(offer.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">List Price</p>
                  <p className="text-xl font-bold">{listing ? formatPrice(listing.price, listing.currency) : 'N/A'}</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                  <p className="text-sm text-orange-700 mb-1">Your Offer</p>
                  <p className="text-xl font-bold text-[#df5e15]">{formatPrice(offer.currentOfferAmount)}</p>
                </div>
                {offer.counterOfferAmount && (
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 sm:col-span-2">
                    <p className="text-sm text-blue-700 mb-1">Seller's Counter Offer</p>
                    <p className="text-xl font-bold text-blue-600">{formatPrice(offer.counterOfferAmount)}</p>
                    {listing && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {Math.round(((listing.price - offer.counterOfferAmount) / listing.price) * 100)}% off list price
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons for Countered Offer */}
              {canRespond && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="font-medium text-blue-800 mb-3">
                    The seller has made a counter offer of {formatPrice(offer.counterOfferAmount!)}.
                  </p>
                  <p className="text-sm text-blue-700 mb-3">
                    If you&apos;re not satisfied with this counter offer, you can reject it and submit a new offer on the listing.
                  </p>
                  <Button
                    onClick={handleReject}
                    disabled={isActioning}
                    variant="outline"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  >
                    {isActioning ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    Reject Counter Offer
                  </Button>
                </div>
              )}

              {/* Status Messages */}
              {offer.status === 'accepted' && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800">
                    <CheckCircle className="h-5 w-5" />
                    <p className="font-medium">Offer Accepted!</p>
                  </div>
                  <p className="text-sm text-green-700 mt-2">
                    Item automatically added to your cart at the agreed price of {formatPrice(offer.currentOfferAmount)}.
                  </p>
                  {isBuyer && (
                    <Button
                      className="mt-3 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => router.push('/cart')}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Go to Cart
                    </Button>
                  )}
                  {!isBuyer && listing && listing.disabled && (
                    <p className="text-sm text-red-600 mt-2">
                      This listing has already been sold.
                    </p>
                  )}
                </div>
              )}

              {offer.status === 'rejected' && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800">
                    <XCircle className="h-5 w-5" />
                    <p className="font-medium">Offer Declined</p>
                  </div>
                  <p className="text-sm text-red-700 mt-1">
                    This offer has been declined. You can make a new offer on this listing if it's still available.
                  </p>
                </div>
              )}

              {offer.status === 'pending' && (
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-800">
                    <Clock className="h-5 w-5" />
                    <p className="font-medium">Waiting for Seller Response</p>
                  </div>
                  <p className="text-sm text-yellow-700 mt-1">
                    The seller will review your offer and respond soon.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Offer History / Messages */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Offer History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {offer.messages.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No messages yet.</p>
                ) : (
                  offer.messages.map((message, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg ${
                        message.isSystemMessage
                          ? 'bg-muted/50 border border-muted'
                          : message.senderId === offer.buyerId
                          ? 'bg-orange-50 border border-orange-200 ml-4'
                          : 'bg-blue-50 border border-blue-200 mr-4'
                      }`}
                    >
                      {message.isSystemMessage ? (
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">{message.messageText}</p>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {formatDate(message.createdAt)} at {formatTime(message.createdAt)}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 mb-1">
                            <User className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              {message.senderId === offer.buyerId ? 'You' : 'Seller'}
                            </span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {formatDate(message.createdAt)} at {formatTime(message.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm">{message.messageText}</p>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Listing Info */}
        <div className="space-y-6">
          {listing && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Listing</CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={`/listing/${listing.id}`} className="block">
                  <div className="relative w-full aspect-square bg-gradient-to-br from-muted to-muted/50 rounded-lg overflow-hidden mb-4">
                    {listing.image ? (
                      <Image
                        src={listing.image}
                        alt={listing.listingTitle}
                        fill
                        className="object-cover hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <span className="text-6xl">🎸</span>
                      </div>
                    )}
                    {listing.disabled && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-semibold">SOLD</span>
                      </div>
                    )}
                  </div>
                </Link>

                {listing.condition && (
                  <p className="text-sm text-muted-foreground mb-1">Used - {listing.condition}</p>
                )}
                <Link href={`/listing/${listing.id}`}>
                  <h3 className="font-semibold text-lg mb-2 hover:text-[#df5e15] transition-colors line-clamp-2">
                    {listing.listingTitle}
                  </h3>
                </Link>
                <p className="text-2xl font-bold text-foreground mb-3">
                  {formatPrice(listing.price, listing.currency)}
                </p>

                <Link href={`/listing/${listing.id}`}>
                  <Button variant="outline" className="w-full">
                    View Listing
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          {isActive && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {listing && (
                  <Link href={`/messages?listing=${listing.id}`}>
                    <Button variant="outline" className="w-full">
                      <Send className="h-4 w-4 mr-2" />
                      Message Seller
                    </Button>
                  </Link>
                )}
                {offer.status === 'pending' && isBuyer && (
                  <Button
                    variant="outline"
                    className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    onClick={handleReject}
                    disabled={isActioning}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Withdraw Offer
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
