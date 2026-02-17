'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Tag, Clock, CheckCircle, XCircle, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';

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

type StatusFilter = 'all' | 'pending' | 'countered' | 'accepted' | 'rejected';

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

export default function OffersPage() {
  const { isAuthenticated, isLoading: authLoading, setShowLoginModal } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    const fetchOffers = async () => {
      try {
        const endpoint = statusFilter === 'all' ? '/offers' : `/offers?status=${statusFilter}`;
        const data = await api.get<Offer[]>(endpoint, {
          headers: getAuthHeaders(),
        });
        setOffers(data);
      } catch (error) {
        console.error('Failed to fetch offers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOffers();
  }, [isAuthenticated, authLoading, statusFilter]);

  const filterCounts = {
    all: offers.length,
    pending: offers.filter(o => o.status === 'pending').length,
    countered: offers.filter(o => o.status === 'countered').length,
    accepted: offers.filter(o => o.status === 'accepted').length,
    rejected: offers.filter(o => o.status === 'rejected').length,
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
          href="/"
          className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to listings
        </Link>

        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <Tag className="h-16 w-16 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Sign in to view your offers</h2>
            <p className="text-muted-foreground">
              Create an account or sign in to make and manage offers on guitars.
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

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to listings
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">My Offers</h1>
        <p className="text-muted-foreground">
          Track and manage your offers on guitars
        </p>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(['all', 'pending', 'countered', 'accepted', 'rejected'] as StatusFilter[]).map((status) => (
          <Button
            key={status}
            variant={statusFilter === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(status)}
            className={statusFilter === status ? 'bg-[#df5e15] hover:bg-[#c54d0a]' : ''}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status === 'all' && ` (${filterCounts.all})`}
            {status === 'countered' && filterCounts.countered > 0 && (
              <span className="ml-1 bg-blue-500 text-white text-xs rounded-full px-1.5">
                {filterCounts.countered}
              </span>
            )}
          </Button>
        ))}
      </div>

      {offers.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <Tag className="h-16 w-16 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">
              {statusFilter === 'all' ? 'No offers yet' : `No ${statusFilter} offers`}
            </h2>
            <p className="text-muted-foreground">
              {statusFilter === 'all'
                ? 'Browse listings and make an offer to start negotiating.'
                : `You don't have any offers with ${statusFilter} status.`}
            </p>
            <Link href="/">
              <Button className="bg-[#df5e15] hover:bg-[#c54d0a] text-white">
                Browse Listings
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {offers.map(offer => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}
    </div>
  );
}

interface OfferCardProps {
  offer: Offer;
}

function OfferCard({ offer }: OfferCardProps) {
  const listing = offer.listing;

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col">
      <Link href={listing ? `/listing/${listing.id}` : '#'} className="block cursor-pointer">
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
      </Link>
      <CardContent className="flex flex-col flex-1 p-4">
        <div className="flex justify-between items-start mb-2">
          {getStatusBadge(offer.status)}
          <span className="text-xs text-muted-foreground">{formatDate(offer.createdAt)}</span>
        </div>

        {listing && (
          <>
            {listing.condition && (
              <p className="text-sm text-muted-foreground mb-1">Used - {listing.condition}</p>
            )}
            <Link href={`/listing/${listing.id}`} className="cursor-pointer">
              <h3 className="font-semibold text-lg mb-2 line-clamp-2 hover:text-[#df5e15] transition-colors">
                {listing.listingTitle}
              </h3>
            </Link>
          </>
        )}

        <div className="space-y-1 mb-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">List Price:</span>
            <span className="font-medium">{listing ? formatPrice(listing.price, listing.currency) : 'N/A'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Your Offer:</span>
            <span className="font-bold text-[#df5e15]">{formatPrice(offer.currentOfferAmount)}</span>
          </div>
          {offer.counterOfferAmount && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Counter Offer:</span>
              <span className="font-bold text-blue-600">{formatPrice(offer.counterOfferAmount)}</span>
            </div>
          )}
        </div>

        {offer.status === 'countered' && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-2 mb-3">
            <p className="text-sm text-blue-700">
              Seller has countered! Review and respond to their offer.
            </p>
          </div>
        )}

        <div className="mt-auto">
          <Link href={`/offers/${offer.id}`}>
            <Button className="w-full bg-[#df5e15] hover:bg-[#c54d0a] text-white">
              View Details
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
