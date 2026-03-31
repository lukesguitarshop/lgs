'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ShoppingCart, ArrowLeft, Check, Download, Copy, Heart, Tag, MessageSquare, AlertTriangle, X } from 'lucide-react';
import JSZip from 'jszip';
import DOMPurify from 'dompurify';
import { addToCart, isInCart, CartItem } from '@/lib/cart';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';
import ReviewsCarousel from './ReviewsCarousel';
import { MakeOfferModal } from '@/components/offers/MakeOfferModal';
import { trackAddToCart, trackViewItem } from '@/lib/analytics';

interface Listing {
  id: string;
  listing_title: string;
  description: string | null;
  condition: string | null;
  images: string[];
  reverb_link: string | null;
  price: number;
  original_price: number | null;
  currency: string;
  scraped_at: string;
  listed_at: string | null;
  disabled?: boolean;
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
  const router = useRouter();
  const { isAuthenticated, setShowLoginModal } = useAuth();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [inCart, setInCart] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [descriptionCopied, setDescriptionCopied] = useState(false);
  const [titleCopied, setTitleCopied] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [isMessageLoading, setIsMessageLoading] = useState(false);
  const [existingOfferConversationId, setExistingOfferConversationId] = useState<string | null>(null);
  const images = listing.images && listing.images.length > 0 ? listing.images : [];
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);

  // Check if item is already in cart on mount
  useEffect(() => {
    setInCart(isInCart(listing.id));
  }, [listing.id]);

  // Track view item event for analytics
  useEffect(() => {
    trackViewItem({
      id: listing.id,
      name: listing.listing_title,
      price: listing.price,
      currency: listing.currency,
    });
  }, [listing.id, listing.listing_title, listing.price, listing.currency]);

  // Check if listing is favorited on mount
  useEffect(() => {
    const checkFavorite = async () => {
      if (!isAuthenticated) {
        setIsFavorite(false);
        return;
      }
      try {
        const response = await api.get<{ isFavorited: boolean }>(`/favorites/check/${listing.id}`, {
          headers: getAuthHeaders(),
        });
        setIsFavorite(response.isFavorited);
      } catch {
        setIsFavorite(false);
      }
    };
    checkFavorite();
  }, [listing.id, isAuthenticated]);

  // Check if user has an existing conversation with an offer for this listing
  useEffect(() => {
    const checkExistingOffer = async () => {
      if (!isAuthenticated) {
        setExistingOfferConversationId(null);
        return;
      }
      try {
        interface ConversationWithOffer {
          id: string;
          listingId: string | null;
          offerStatus?: string;
        }
        const conversations = await api.get<ConversationWithOffer[]>('/messages/conversations', {
          headers: getAuthHeaders(),
        });
        // Find a conversation for this listing that has an offer (active, accepted, or declined)
        const existingConv = conversations.find(
          c => c.listingId === listing.id && c.offerStatus != null
        );
        setExistingOfferConversationId(existingConv?.id || null);
      } catch {
        setExistingOfferConversationId(null);
      }
    };
    checkExistingOffer();
  }, [listing.id, isAuthenticated]);

  const copyTitle = async () => {
    await navigator.clipboard.writeText(listing.listing_title);
    setTitleCopied(true);
    setTimeout(() => setTitleCopied(false), 2000);
  };

  const handleToggleFavorite = async () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    setIsFavoriteLoading(true);
    try {
      if (isFavorite) {
        await api.delete(`/favorites/${listing.id}`, {
          headers: getAuthHeaders(),
        });
        setIsFavorite(false);
      } else {
        await api.post(`/favorites/${listing.id}`, null, {
          headers: getAuthHeaders(),
        });
        setIsFavorite(true);
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    } finally {
      setIsFavoriteLoading(false);
    }
  };

  const handleMakeOffer = () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    // If there's an existing conversation with an offer, go to it
    if (existingOfferConversationId) {
      router.push(`/messages/${existingOfferConversationId}?from=listing&listingId=${listing.id}`);
      return;
    }
    setShowOfferModal(true);
  };

  const handleMessageSeller = async () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    setIsMessageLoading(true);
    try {
      const response = await api.post<{ conversationId: string }>(
        '/messages/contact-seller',
        { listingId: listing.id },
        { headers: getAuthHeaders() }
      );
      router.push(`/messages/${response.conversationId}`);
    } catch (error) {
      console.error('Failed to contact seller:', error);
    } finally {
      setIsMessageLoading(false);
    }
  };

  // Auto-scroll thumbnail strip to keep active thumbnail visible
  useEffect(() => {
    if (thumbnailContainerRef.current && images.length > 1) {
      const container = thumbnailContainerRef.current;
      const thumbnailWidth = 80; // w-20 = 5rem = 80px
      const gap = 8; // gap-2 = 0.5rem = 8px
      const scrollPosition = currentImageIndex * (thumbnailWidth + gap);
      const containerWidth = container.clientWidth;

      // Center the active thumbnail in the container
      const targetScroll = scrollPosition - (containerWidth / 2) + (thumbnailWidth / 2);

      container.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: 'smooth'
      });
    }
  }, [currentImageIndex, images.length]);

  const goToPrevious = useCallback(() => {
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }, [images.length]);

  const goToNext = useCallback(() => {
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }, [images.length]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
      if (e.key === 'ArrowLeft') goToPrevious();
      if (e.key === 'ArrowRight') goToNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, goToPrevious, goToNext]);

  const handleAddToCart = () => {
    const cartItem: CartItem = {
      id: listing.id,
      title: listing.listing_title,
      price: listing.price,
      currency: listing.currency,
      image: images[0] || '',
    };
    addToCart(cartItem);
    trackAddToCart({
      id: listing.id,
      name: listing.listing_title,
      price: listing.price,
      currency: listing.currency,
    });
    setInCart(true);
    setJustAdded(true);

    // Reset "just added" state after 2 seconds
    setTimeout(() => {
      setJustAdded(false);
    }, 2000);
  };

  const getFullQualityUrl = (url: string): string => {
    // Reverb URL format: https://rvb-img.reverb.com/i/s--HASH--/quality=medium-low,height=800,.../UUID.jpeg
    // Strip the transformation segment (path segment containing '=') to get the original
    if (url.includes('rvb-img.reverb.com')) {
      return url.replace(/\/[^/]*=[^/]*/g, '');
    }
    return url;
  };

  const handleDownloadPhotos = async () => {
    if (images.length === 0) return;

    setIsDownloading(true);

    try {
      const zip = new JSZip();

      // Fetch all images and add to zip
      const fetchPromises = images.map(async (imageUrl, index) => {
        try {
          const response = await fetch(getFullQualityUrl(imageUrl));
          const blob = await response.blob();

          // Get file extension from URL or default to jpg
          const urlParts = imageUrl.split('.');
          const ext = urlParts[urlParts.length - 1].split('?')[0].toLowerCase();
          const extension = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? ext : 'jpg';

          zip.file(`${index + 1}.${extension}`, blob);
        } catch (err) {
          console.error(`Failed to fetch image ${index + 1}:`, err);
        }
      });

      await Promise.all(fetchPromises);

      // Generate zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Create sanitized filename from listing title
      const sanitizedTitle = listing.listing_title
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 100);

      // Trigger download
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sanitizedTitle}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to create zip:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyDescription = async () => {
    if (!listing.description) return;

    // Convert HTML to formatted plain text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = listing.description;

    // Replace block elements with newlines for proper formatting
    const blockElements = tempDiv.querySelectorAll('p, br, li, h1, h2, h3, h4, h5, h6, div');
    blockElements.forEach((el) => {
      if (el.tagName === 'BR') {
        el.replaceWith('\n');
      } else if (el.tagName === 'LI') {
        el.prepend('• ');
        el.append('\n');
      } else {
        el.append('\n');
      }
    });

    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    // Clean up multiple consecutive newlines
    const cleanedText = plainText.replace(/\n{3,}/g, '\n\n').trim();

    try {
      await navigator.clipboard.writeText(cleanedText);
      setDescriptionCopied(true);
      setTimeout(() => setDescriptionCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy description:', err);
    }
  };

  const [sanitizedDescription, setSanitizedDescription] = useState('');

  useEffect(() => {
    if (listing.description) {
      setSanitizedDescription(
        DOMPurify.sanitize(listing.description, {
          ALLOWED_TAGS: ['p', 'br', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'a', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
          ALLOWED_ATTR: ['href', 'target', 'rel'],
        })
      );
    }
  }, [listing.description]);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Left side - Image carousel */}
        <div className="space-y-4">
          {/* Download Photos button */}
          {images.length > 0 && (
            <Button
              variant="outline"
              className="py-2 text-sm"
              onClick={handleDownloadPhotos}
              disabled={isDownloading}
            >
              <Download className="h-4 w-4 mr-2" />
              {isDownloading ? 'Downloading...' : `Download Photos (${images.length})`}
            </Button>
          )}

          {/* Main image */}
          <div className="relative aspect-square bg-card rounded-lg overflow-hidden border border-border shadow-sm">
            {images.length > 0 ? (
              <>
                <Image
                  src={getFullQualityUrl(images[currentImageIndex])}
                  alt={`${listing.listing_title} - Image ${currentImageIndex + 1}`}
                  fill
                  className="object-contain cursor-zoom-in"
                  priority
                  quality={100}
                  onClick={() => setIsFullscreen(true)}
                />
                {/* Navigation arrows */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={goToPrevious}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-card/90 hover:bg-card rounded-full p-2 shadow-md transition-all cursor-pointer"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="h-6 w-6 text-foreground" />
                    </button>
                    <button
                      onClick={goToNext}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-card/90 hover:bg-card rounded-full p-2 shadow-md transition-all cursor-pointer"
                      aria-label="Next image"
                    >
                      <ChevronRight className="h-6 w-6 text-foreground" />
                    </button>
                  </>
                )}
                {/* Image counter */}
                {images.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#020E1C]/70 text-[#FFFFF3] text-sm px-3 py-1 rounded-full">
                    {currentImageIndex + 1} / {images.length}
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-gradient-to-br from-muted to-muted/50">
                <span className="text-8xl">🎸</span>
              </div>
            )}
          </div>

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div ref={thumbnailContainerRef} className="flex gap-2 overflow-x-auto pb-2">
              {images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`relative flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 transition-all cursor-pointer ${
                    index === currentImageIndex
                      ? 'border-[#6E0114] ring-2 ring-[#6E0114]/30'
                      : 'border-border hover:border-muted-foreground'
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
          {/* SOLD banner */}
          {listing.disabled && (
            <div className="bg-[#6E0114] text-[#FFFFF3] rounded-lg p-4 flex items-center gap-3">
              <span className="text-2xl font-bold">SOLD</span>
              <span className="text-sm opacity-90">This guitar has found a new home</span>
            </div>
          )}

          {/* Condition badge */}
          {listing.condition && (
            <div className="text-sm text-muted-foreground">
              Used - {listing.condition}
            </div>
          )}

          {/* Title */}
          <div className="flex items-start gap-2">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground leading-tight">
              {listing.listing_title}
            </h1>
            <button
              onClick={copyTitle}
              className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 mt-1"
              title="Copy title"
            >
              {titleCopied ? (
                <Check className="h-5 w-5 text-green-500" />
              ) : (
                <Copy className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Price section */}
          <div className="border-t border-b border-border py-6">
            {listing.original_price && listing.price < listing.original_price ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-[#6E0114] text-[#FFFFF3] text-sm font-bold px-2 py-1 rounded">
                    ON SALE
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-[#6E0114]">
                    {formatPrice(listing.price, listing.currency)}
                  </span>
                  <span className="text-xl text-gray-400 line-through">
                    {formatPrice(listing.original_price, listing.currency)}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">
                  {formatPrice(listing.price, listing.currency)}
                </span>
              </div>
            )}
            <p className="text-green-600 font-medium mt-1">+ Free Shipping</p>
          </div>

          {/* Add to cart and favorite buttons */}
          <div className="flex gap-3">
            <Button
              className={`flex-1 font-semibold py-6 text-lg transition-all ${
                listing.disabled
                  ? 'bg-gray-400 text-[#FFFFF3] cursor-not-allowed'
                  : inCart
                  ? 'bg-green-600 hover:bg-green-700 text-[#FFFFF3]'
                  : 'bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3]'
              }`}
              onClick={handleAddToCart}
              disabled={inCart || listing.disabled}
            >
              {listing.disabled ? (
                'SOLD'
              ) : inCart ? (
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
            <Button
              variant="outline"
              className={`py-6 px-4 transition-all ${
                isFavorite
                  ? 'text-red-500 border-red-200 hover:bg-red-50'
                  : 'text-muted-foreground hover:text-red-500 hover:border-red-200'
              }`}
              onClick={handleToggleFavorite}
              disabled={isFavoriteLoading}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart className={`h-6 w-6 ${isFavorite ? 'fill-current' : ''}`} />
            </Button>
          </div>

          {/* Make Offer and Message Seller buttons */}
          {!listing.disabled && (
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 py-6 text-lg"
                onClick={handleMakeOffer}
              >
                <Tag className="h-5 w-5 mr-2" />
                {existingOfferConversationId ? 'View Offer(s)' : 'Make an Offer'}
              </Button>
              <Button
                variant="outline"
                className="flex-1 py-6 text-base sm:text-lg"
                onClick={handleMessageSeller}
                disabled={isMessageLoading}
              >
                <MessageSquare className="h-5 w-5 mr-2" />
                {isMessageLoading ? 'Opening...' : "Message Seller"}
              </Button>
            </div>
          )}

          {/* Description section */}
          {sanitizedDescription && (
            <div className="pt-6 border-t border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Description</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyDescription}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-4 w-4 mr-1" />
                  {descriptionCopied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <div
                className="text-muted-foreground leading-relaxed [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:my-2 [&_li]:my-1 [&_p]:my-2 [&_br]:block [&_a]:text-[#6E0114] [&_a]:underline [&_strong]:font-semibold [&_b]:font-semibold"
                dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
              />
            </div>
          )}

          {/* Additional details */}
          <div className="pt-6 border-t border-border text-sm text-muted-foreground flex items-center justify-between">
            <p>
              Listed on {listing.listed_at
                ? new Date(listing.listed_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
                : 'Reverb'}
            </p>
            {listing.reverb_link && (
              <a
                href={listing.reverb_link}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground transition-colors cursor-pointer"
              >
                View on Reverb
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Reviews Carousel */}
      <ReviewsCarousel />

      {/* Fullscreen image overlay */}
      {isFullscreen && images.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setIsFullscreen(false)}
        >
          {/* Close button */}
          <button
            className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-colors cursor-pointer"
            onClick={() => setIsFullscreen(false)}
            aria-label="Close fullscreen"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Image */}
          <div
            className="relative w-[90vw] h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={getFullQualityUrl(images[currentImageIndex])}
              alt={`${listing.listing_title} - Image ${currentImageIndex + 1}`}
              fill
              className="object-contain"
              quality={100}
            />
          </div>

          {/* Prev/Next arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 rounded-full p-3 text-white transition-colors cursor-pointer"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-7 w-7" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); goToNext(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 rounded-full p-3 text-white transition-colors cursor-pointer"
                aria-label="Next image"
              >
                <ChevronRight className="h-7 w-7" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-sm px-3 py-1 rounded-full">
                {currentImageIndex + 1} / {images.length}
              </div>
            </>
          )}
        </div>
      )}

      {/* Make Offer Modal */}
      <MakeOfferModal
        open={showOfferModal}
        onOpenChange={setShowOfferModal}
        listing={{
          id: listing.id,
          title: listing.listing_title,
          price: listing.price,
          currency: listing.currency,
        }}
      />
    </div>
  );
}
