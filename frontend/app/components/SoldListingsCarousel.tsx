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
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  const checkScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 10
    );
  };

  useEffect(() => {
    checkScrollButtons();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollButtons);
      window.addEventListener('resize', checkScrollButtons);
      return () => {
        container.removeEventListener('scroll', checkScrollButtons);
        window.removeEventListener('resize', checkScrollButtons);
      };
    }
  }, [listings]);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 240; // card width + gap
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

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
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className={`p-2 rounded-full border border-border transition-colors ${
              canScrollLeft
                ? 'bg-card hover:bg-muted cursor-pointer'
                : 'bg-muted/50 text-muted-foreground/50 cursor-not-allowed'
            }`}
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className={`p-2 rounded-full border border-border transition-colors ${
              canScrollRight
                ? 'bg-card hover:bg-muted cursor-pointer'
                : 'bg-muted/50 text-muted-foreground/50 cursor-not-allowed'
            }`}
            aria-label="Scroll right"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {listings.map((listing) => (
          <Link key={listing.id} href={`/listing/${listing.id}`} className="flex-shrink-0">
            <Card className="w-56 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
              <div className="relative aspect-square">
                {listing.images && listing.images.length > 0 ? (
                  <Image
                    src={listing.images[0]}
                    alt={listing.listing_title}
                    fill
                    className="object-cover"
                    sizes="224px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <span className="text-4xl">🎸</span>
                  </div>
                )}
                <div className="absolute top-2 left-2 bg-[#6E0114] text-[#FFFFF3] text-xs font-bold px-2 py-1 rounded">
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
      </div>

      <div className="flex justify-center mt-6">
        <Link
          href="/sold"
          className="px-6 py-2 text-sm font-medium text-[#6E0114] hover:text-[#580110] border border-[#6E0114] hover:border-[#580110] rounded-lg transition-colors"
        >
          View all sold listings
        </Link>
      </div>
    </div>
  );
}
