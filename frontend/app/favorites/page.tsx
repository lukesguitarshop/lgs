'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, ArrowLeft, Loader2 } from 'lucide-react';
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

interface Favorite {
  id: string;
  listingId: string;
  createdAt: string;
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

export default function FavoritesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, setShowLoginModal } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    const fetchFavorites = async () => {
      try {
        const data = await api.get<Favorite[]>('/favorites', {
          headers: getAuthHeaders(),
        });
        setFavorites(data);
      } catch (error) {
        console.error('Failed to fetch favorites:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFavorites();
  }, [isAuthenticated, authLoading]);

  const handleRemoveFavorite = async (listingId: string) => {
    setRemovingId(listingId);
    try {
      await api.delete(`/favorites/${listingId}`, {
        headers: getAuthHeaders(),
      });
      setFavorites(prev => prev.filter(f => f.listingId !== listingId));
    } catch (error) {
      console.error('Failed to remove favorite:', error);
    } finally {
      setRemovingId(null);
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
          href="/"
          className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to listings
        </Link>

        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <Heart className="h-16 w-16 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Sign in to view your favorites</h2>
            <p className="text-muted-foreground">
              Create an account or sign in to save your favorite guitars.
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
        <h1 className="text-3xl font-bold mb-2">My Favorites</h1>
        <p className="text-muted-foreground">
          {favorites.length} saved {favorites.length === 1 ? 'listing' : 'listings'}
        </p>
      </div>

      {favorites.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <Heart className="h-16 w-16 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">No favorites yet</h2>
            <p className="text-muted-foreground">
              Browse listings and click the heart icon to save your favorites.
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
          {favorites.map(favorite => (
            <FavoriteCard
              key={favorite.id}
              favorite={favorite}
              onRemove={handleRemoveFavorite}
              isRemoving={removingId === favorite.listingId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FavoriteCardProps {
  favorite: Favorite;
  onRemove: (listingId: string) => void;
  isRemoving: boolean;
}

function FavoriteCard({ favorite, onRemove, isRemoving }: FavoriteCardProps) {
  const listing = favorite.listing;

  // Handle case where listing was deleted
  if (!listing) {
    return (
      <Card className="overflow-hidden h-full flex flex-col">
        <div className="relative w-full aspect-square bg-gradient-to-br from-muted to-muted/50">
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <span className="text-6xl">🎸</span>
          </div>
        </div>
        <CardContent className="flex flex-col flex-1 p-4">
          <p className="text-muted-foreground mb-2">This listing is no longer available</p>
          <div className="mt-auto">
            <Button
              variant="outline"
              className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              onClick={() => onRemove(favorite.listingId)}
              disabled={isRemoving}
            >
              {isRemoving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Heart className="h-4 w-4 mr-2 fill-current" />
              )}
              Remove from Favorites
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col">
      <Link href={`/listing/${listing.id}`} className="block">
        <div className="relative w-full aspect-square bg-gradient-to-br from-muted to-muted/50">
          {listing.image ? (
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
        </div>
      </Link>
      <CardContent className="flex flex-col flex-1 p-4">
        {listing.condition && (
          <p className="text-sm text-muted-foreground mb-1">Used - {listing.condition}</p>
        )}
        <Link href={`/listing/${listing.id}`}>
          <h3 className="font-semibold text-lg mb-2 line-clamp-2 hover:text-[#df5e15] transition-colors">
            {listing.listingTitle}
          </h3>
        </Link>
        <p className="text-2xl font-bold text-foreground mb-1">
          {formatPrice(listing.price, listing.currency)}
        </p>
        <p className="text-sm text-green-600 mb-3">+ Free Shipping</p>
        <div className="mt-auto space-y-2">
          <Link href={`/listing/${listing.id}`} className="block">
            <Button className="w-full bg-[#df5e15] hover:bg-[#c54d0a] text-white">
              View Details
            </Button>
          </Link>
          <Button
            variant="outline"
            className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            onClick={() => onRemove(listing.id)}
            disabled={isRemoving}
          >
            {isRemoving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Heart className="h-4 w-4 mr-2 fill-current" />
            )}
            Remove from Favorites
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
