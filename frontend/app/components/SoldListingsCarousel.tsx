'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/lib/api';

interface SoldListing {
  id: string;
  listing_title: string;
  images: string[];
  price: number;
  currency: string;
}

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export default function SoldListingsCarousel() {
  const [listings, setListings] = useState<SoldListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchSoldListings() {
      try {
        const response = await api.get<SoldListing[]>('/listings/sold?limit=8');
        setListings(response);
      } catch (err) {
        console.error('Error fetching sold listings:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchSoldListings();
  }, []);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? listings.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === listings.length - 1 ? 0 : prev + 1));
  };

  useEffect(() => {
    if (containerRef.current && listings.length > 0) {
      const cardWidth = 224; // w-56 = 14rem = 224px
      const gap = 16; // gap-4
      const spacerWidth = 16 + gap;
      const containerWidth = containerRef.current.clientWidth;
      const cardPosition = spacerWidth + currentIndex * (cardWidth + gap);
      const scrollPosition = cardPosition - (containerWidth / 2) + (cardWidth / 2);

      containerRef.current.scrollTo({
        left: Math.max(0, scrollPosition),
        behavior: 'smooth'
      });
    }
  }, [currentIndex, listings.length]);

  if (loading) {
    return (
      <div className="mt-12 pt-8 border-t border-border">
        <h2 className="text-xl font-bold mb-6">Recently Sold</h2>
        <div className="flex justify-center items-center h-48">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  if (listings.length === 0) {
    return null;
  }

  return (
    <div className="mt-12 pt-8 border-t border-border">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Recently Sold</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {listings.length}
          </span>
          <button
            onClick={goToPrevious}
            className="p-2 rounded-full bg-card hover:bg-muted border border-border transition-colors"
            aria-label="Previous listing"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={goToNext}
            className="p-2 rounded-full bg-card hover:bg-muted border border-border transition-colors"
            aria-label="Next listing"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative">
        <div
          ref={containerRef}
          className="flex gap-4 overflow-x-auto px-4 py-4 scroll-smooth snap-x snap-mandatory scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="flex-shrink-0 w-4" aria-hidden="true" />
          {listings.map((listing, index) => (
            <Link key={listing.id} href={`/listing/${listing.id}`}>
              <Card
                className={`flex-shrink-0 w-56 snap-start transition-all duration-300 cursor-pointer hover:shadow-lg ${
                  index === currentIndex
                    ? 'ring-2 ring-[#df5e15] shadow-lg'
                    : 'opacity-70'
                }`}
              >
                <div className="relative aspect-square">
                  {listing.images && listing.images.length > 0 ? (
                    <Image
                      src={listing.images[0]}
                      alt={listing.listing_title}
                      fill
                      className="object-cover rounded-t-lg"
                      sizes="224px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted rounded-t-lg">
                      <span className="text-4xl">🎸</span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
                    SOLD
                  </div>
                </div>
                <CardContent className="p-3">
                  <h3 className="font-medium text-sm line-clamp-2 mb-1">
                    {listing.listing_title}
                  </h3>
                  <p className="text-sm font-semibold text-muted-foreground">
                    {formatPrice(listing.price, listing.currency)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
          <div className="flex-shrink-0 w-4" aria-hidden="true" />
        </div>

        <div className="flex justify-center gap-2 mt-4">
          {listings.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-[#df5e15] w-4'
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Go to listing ${index + 1}`}
            />
          ))}
        </div>

        <div className="flex justify-center mt-6">
          <Link
            href="/sold"
            className="px-6 py-2 text-sm font-medium text-[#df5e15] hover:text-[#c54d0a] border border-[#df5e15] hover:border-[#c54d0a] rounded-lg transition-colors"
          >
            View all sold listings
          </Link>
        </div>
      </div>
    </div>
  );
}
