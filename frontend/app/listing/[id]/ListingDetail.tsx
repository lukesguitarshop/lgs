'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ShoppingCart, ExternalLink, ArrowLeft, Check } from 'lucide-react';
import { addToCart, isInCart, CartItem } from '@/lib/cart';

interface Listing {
  id: string;
  listing_title: string;
  description: string | null;
  condition: string | null;
  images: string[];
  reverb_link: string | null;
  price: number;
  currency: string;
  scraped_at: string;
}

function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

interface ListingDetailProps {
  listing: Listing;
}

export default function ListingDetail({ listing }: ListingDetailProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [inCart, setInCart] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const images = listing.images && listing.images.length > 0 ? listing.images : [];

  // Check if item is already in cart on mount
  useEffect(() => {
    setInCart(isInCart(listing.id));
  }, [listing.id]);

  const goToPrevious = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleAddToCart = () => {
    const cartItem: CartItem = {
      id: listing.id,
      title: listing.listing_title,
      price: listing.price,
      currency: listing.currency,
      image: images[0] || '',
    };
    addToCart(cartItem);
    setInCart(true);
    setJustAdded(true);

    // Reset "just added" state after 2 seconds
    setTimeout(() => {
      setJustAdded(false);
    }, 2000);
  };

  const plainDescription = listing.description
    ? listing.description.replace(/<[^>]*>/g, '').trim()
    : '';

  return (
    <div className="max-w-7xl mx-auto">
      {/* Back button */}
      <Link
        href="/search"
        className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to listings
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Left side - Image carousel */}
        <div className="space-y-4">
          {/* Main image */}
          <div className="relative aspect-square bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm">
            {images.length > 0 ? (
              <>
                <Image
                  src={images[currentImageIndex]}
                  alt={`${listing.listing_title} - Image ${currentImageIndex + 1}`}
                  fill
                  className="object-contain"
                  priority
                />
                {/* Navigation arrows */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={goToPrevious}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2 shadow-md transition-all"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="h-6 w-6 text-gray-700" />
                    </button>
                    <button
                      onClick={goToNext}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2 shadow-md transition-all"
                      aria-label="Next image"
                    >
                      <ChevronRight className="h-6 w-6 text-gray-700" />
                    </button>
                  </>
                )}
                {/* Image counter */}
                {images.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm px-3 py-1 rounded-full">
                    {currentImageIndex + 1} / {images.length}
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gradient-to-br from-gray-100 to-gray-200">
                <span className="text-8xl">🎸</span>
              </div>
            )}
          </div>

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`relative flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 transition-all ${
                    index === currentImageIndex
                      ? 'border-[#df5e15] ring-2 ring-[#df5e15]/30'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Image
                    src={image}
                    alt={`Thumbnail ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right side - Product info */}
        <div className="space-y-6">
          {/* Condition badge */}
          {listing.condition && (
            <div className="text-sm text-gray-500">
              Used - {listing.condition}
            </div>
          )}

          {/* Title */}
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 leading-tight">
            {listing.listing_title}
          </h1>

          {/* Price section */}
          <div className="border-t border-b border-gray-200 py-6">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">
                {formatPrice(listing.price, listing.currency)}
              </span>
            </div>
            <p className="text-green-600 font-medium mt-1">+ Free Shipping</p>
          </div>

          {/* Add to cart button */}
          <Button
            className={`w-full font-semibold py-6 text-lg transition-all ${
              inCart
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-[#df5e15] hover:bg-[#c54d0a] text-white'
            }`}
            onClick={handleAddToCart}
            disabled={inCart}
          >
            {inCart ? (
              <>
                <Check className="h-5 w-5 mr-2" />
                {justAdded ? 'Added to Cart!' : 'In Cart'}
              </>
            ) : (
              <>
                <ShoppingCart className="h-5 w-5 mr-2" />
                Add to Cart
              </>
            )}
          </Button>

          {/* View on Reverb link */}
          {listing.reverb_link && (
            <a
              href={listing.reverb_link}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button variant="outline" className="w-full py-6 text-lg">
                <ExternalLink className="h-5 w-5 mr-2" />
                View on Reverb
              </Button>
            </a>
          )}

          {/* Description section */}
          {plainDescription && (
            <div className="pt-6 border-t border-gray-200">
              <h2 className="text-lg font-semibold mb-4">Description</h2>
              <div className="prose prose-gray max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {plainDescription}
                </p>
              </div>
            </div>
          )}

          {/* Additional details */}
          <div className="pt-6 border-t border-gray-200 text-sm text-gray-500">
            <p>Listed on Reverb</p>
          </div>
        </div>
      </div>
    </div>
  );
}
