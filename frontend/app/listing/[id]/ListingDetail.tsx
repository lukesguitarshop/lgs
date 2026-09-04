'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { StateBlock } from '@/components/ui/state-block';
import { StickyBar } from '@/components/ui/sticky-bar';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { ChevronLeft, ChevronRight, ShoppingCart, ArrowLeft, Check, Download, Copy, Heart, Tag, MessageSquare, X } from 'lucide-react';
import JSZip from 'jszip';
import DOMPurify from 'dompurify';
import { addToCart, isInCart, CartItem } from '@/lib/cart';
import { logAddToCart } from '@/lib/activity';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';
import { cn } from '@/lib/utils';
import ReviewsCarousel from './ReviewsCarousel';
import { MakeOfferModal } from '@/components/offers/MakeOfferModal';
import { trackAddToCart, trackViewItem } from '@/lib/analytics';
import { ReservationBanner } from '@/components/listing/ReservationBanner';
import { getListingReservation } from '@/lib/api';
import type { MyReservation } from '@/lib/types/reservation';

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
  /** True when an active reservation holds this guitar. Says nothing about who. */
  is_reserved?: boolean;
  /** "On Hold" or "Pending Trade-In". */
  reservation_badge?: string | null;
  reservation_message?: string | null;
  reserved_for_me?: boolean;
  accepts_offers?: boolean;
}

function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Shared by the phone slides and the desktop main image. Both carry `priority` for the
 * first photo, and React dedupes preloads by URL — identical `sizes` is what makes the
 * two resolve to the same candidate, so the browser fetches it once at every width.
 */
const GALLERY_SIZES = '(max-width: 1024px) 100vw, 50vw';

/** The description's prose styling, identical on phones and desktop. */
const DESCRIPTION_PROSE =
  'text-foreground leading-relaxed [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:my-2 [&_li]:my-1 [&_p]:my-2 [&_br]:block [&_a]:text-primary [&_a]:underline [&_strong]:font-semibold [&_b]:font-semibold';

/** The indicator row holds at most this many bars; longer galleries map onto them. */
const MAX_INDICATOR_BARS = 14;

/** The owner's terms, as they appear on the homepage terms grid. */
const SHIPPING_TERMS = [
  {
    head: 'Payment clears first',
    body: "Nothing is reserved or sold until payment has fully cleared. Pending or unverified payments don't hold an instrument.",
  },
  {
    head: 'Look before you buy',
    body: 'Review every photo and the full description. More photos, measurements, or details on request — ask before you buy, not after.',
  },
  {
    head: 'Sold as-is, all sales final',
    body: "Cancellations aren't accepted once payment clears. A 15% restocking fee applies to any cancelled order, because packing starts immediately.",
  },
  {
    head: 'Returns by approval, 24 hours',
    body: 'Requested within 24 hours of delivery. 15% restocking fee, original packing and accessories, buyer-paid insured return with signature. Refunded after inspection.',
  },
  {
    head: "It's a used instrument",
    body: 'Not a professionally set-up guitar. I do a basic setup so it plays out of the box; minor intonation, action, and tuning adjustments are expected and are yours to make.',
  },
  {
    head: 'Store credit is final',
    body: "Guitars bought with store credit aren't eligible for return under any circumstances.",
  },
];

/** A heading, or a short bold / colon-terminated paragraph doing a heading's job. */
function isHeadingLike(el: Element): boolean {
  if (/^H[1-6]$/.test(el.tagName)) return true;
  if (el.tagName !== 'P' && el.tagName !== 'DIV') return false;
  const text = (el.textContent ?? '').trim();
  if (text.length === 0 || text.length > 40) return false;
  if (text.endsWith(':')) return true;
  // A trailing <br> inside the paragraph is still just a bold heading.
  const children = Array.from(el.childNodes).filter(
    (n) =>
      (n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName !== 'BR') ||
      (n.nodeType === Node.TEXT_NODE && n.textContent?.trim())
  );
  return children.length === 1 && /^(STRONG|B)$/.test((children[0] as Element).tagName);
}

/**
 * Drops headings with nothing under them. Reverb descriptions end in dangling
 * "Return Policy:" and "Payment" headings whose bodies were stripped upstream, so they
 * render as orphan bold lines; a heading is kept only if text follows it before the
 * next heading or the end of the description.
 */
function stripEmptyHeadings(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const candidates = Array.from(doc.body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,div')).filter(isHeadingLike);
  // Last to first, so a run of headings with no body collapses in one pass.
  for (const heading of candidates.reverse()) {
    let hasBody = false;
    for (let next = heading.nextElementSibling; next; next = next.nextElementSibling) {
      if (isHeadingLike(next)) break;
      if ((next.textContent ?? '').trim()) {
        hasBody = true;
        break;
      }
    }
    if (!hasBody) heading.remove();
  }
  return doc.body.innerHTML;
}

interface ListingDetailProps {
  listing: Listing;
}

export default function ListingDetail({ listing }: ListingDetailProps) {
  const router = useRouter();
  const { isAuthenticated, isAdmin, setShowLoginModal } = useAuth();
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
  const [myReservation, setMyReservation] = useState<MyReservation | null>(null);
  const images = useMemo(() => (listing.images && listing.images.length > 0 ? listing.images : []), [listing.images]);
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);
  const phoneThumbRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const stripFrameRef = useRef<number | null>(null);
  // The slide the phone strip itself last reported, so the sync effect can tell a swipe
  // apart from an index change that came from somewhere else.
  const stripIndexRef = useRef(0);

  // A reserved guitar blocks everyone except its holder.
  const isReserved = !!listing.is_reserved;
  const reservedForMe = !!myReservation;
  const blockedByHold = isReserved && !reservedForMe;
  const isOnSale = !!(listing.original_price && listing.price < listing.original_price);
  const addDisabled = inCart || !!listing.disabled || blockedByHold;
  const holdMessage = listing.reservation_message || 'This guitar is currently on hold.';

  // Check if item is already in cart on mount
  useEffect(() => {
    setInCart(isInCart(listing.id));
  }, [listing.id]);

  // Fetch the reservation terms. The server only returns them to the holder — everyone
  // else gets the anonymous shape, so this can't leak who the guitar is held for.
  useEffect(() => {
    if (!listing.is_reserved) {
      setMyReservation(null);
      return;
    }

    let cancelled = false;
    getListingReservation(listing.id)
      .then((state) => {
        if (!cancelled && state.is_mine && state.reservation) {
          setMyReservation(state.reservation);
        }
      })
      .catch(() => {
        // Not the holder, or not logged in — the anonymous "on hold" UI is correct.
        if (!cancelled) setMyReservation(null);
      });

    return () => {
      cancelled = true;
    };
  }, [listing.id, listing.is_reserved, isAuthenticated]);

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

  // Preload adjacent carousel images using native browser preloading (avoids Vercel Image Optimization)
  useEffect(() => {
    if (images.length <= 1) return;
    const preloadIndexes = [
      (currentImageIndex + 1) % images.length,
      (currentImageIndex - 1 + images.length) % images.length,
    ];
    preloadIndexes.forEach((i) => {
      const img = new window.Image();
      img.src = images[i];
    });
  }, [currentImageIndex, images]);

  // Auto-scroll whichever thumbnail strip is on screen to keep the active thumbnail
  // visible; the other one is display:none and measures zero, so it is skipped.
  useEffect(() => {
    if (images.length <= 1) return;
    const centerActiveThumb = (container: HTMLDivElement | null, thumbnailWidth: number, gap: number) => {
      if (!container || container.clientWidth === 0) return;
      const scrollPosition = currentImageIndex * (thumbnailWidth + gap);
      const containerWidth = container.clientWidth;

      // Center the active thumbnail in the container
      const targetScroll = scrollPosition - (containerWidth / 2) + (thumbnailWidth / 2);

      container.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: 'smooth'
      });
    };
    centerActiveThumb(thumbnailContainerRef.current, 80, 8); // desktop: w-20 + gap-2
    centerActiveThumb(phoneThumbRef.current, 56, 6); // phone: w-14 + gap-1.5
  }, [currentImageIndex, images.length]);

  const scrollStripTo = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    const strip = stripRef.current;
    if (!strip || strip.clientWidth === 0) return;
    strip.scrollTo({ left: index * strip.clientWidth, behavior });
  }, []);

  // While the user swipes, the strip is the source of truth: the slide it settles on
  // drives the counter, the bars, the thumbnails and the fullscreen viewer. Scroll
  // events arrive faster than they are worth rendering, so read once per frame.
  const handleStripScroll = () => {
    const strip = stripRef.current;
    if (!strip) return;
    if (stripFrameRef.current !== null) cancelAnimationFrame(stripFrameRef.current);
    stripFrameRef.current = requestAnimationFrame(() => {
      stripFrameRef.current = null;
      const width = strip.clientWidth;
      if (width === 0) return;
      const index = Math.max(0, Math.min(images.length - 1, Math.round(strip.scrollLeft / width)));
      stripIndexRef.current = index;
      setCurrentImageIndex(index);
    });
  };

  // The reverse direction: an index change from the fullscreen viewer's arrows (or the
  // desktop gallery) moves the strip. A change the strip reported itself is skipped, or a
  // swipe would bounce back through setState into a second scroll.
  useEffect(() => {
    if (stripIndexRef.current === currentImageIndex) return;
    stripIndexRef.current = currentImageIndex;
    scrollStripTo(currentImageIndex, 'auto');
  }, [currentImageIndex, scrollStripTo]);

  useEffect(() => {
    return () => {
      if (stripFrameRef.current !== null) cancelAnimationFrame(stripFrameRef.current);
    };
  }, []);

  const openFullscreenAt = (index: number) => {
    setCurrentImageIndex(index);
    setIsFullscreen(true);
  };

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
    logAddToCart(listing.id, listing.listing_title);
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
        stripEmptyHeadings(
          DOMPurify.sanitize(listing.description, {
            ALLOWED_TAGS: ['p', 'br', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'a', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
            ALLOWED_ATTR: ['href', 'target', 'rel'],
          })
        )
      );
    }
  }, [listing.description]);

  const listedOn = listing.listed_at
    ? new Date(listing.listed_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
    : 'Reverb';

  const barCount = Math.min(images.length, MAX_INDICATOR_BARS);
  const activeBar =
    images.length <= MAX_INDICATOR_BARS || images.length < 2
      ? currentImageIndex
      : Math.round((currentImageIndex * (barCount - 1)) / (images.length - 1));

  const favoriteLabel = isFavorite ? 'Remove from favorites' : 'Add to favorites';

  return (
    <div className="max-w-7xl mx-auto">
      {/* ------------------------------------------------------------------ */}
      {/* Phone composition (below md). Everything here is fed by the same state
          as the desktop block, which is display:none at these widths.          */}
      {/* ------------------------------------------------------------------ */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => router.back()}
          className="label-mono flex h-12 cursor-pointer items-center gap-2 text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to listings
        </button>

        {/* Full-bleed snap gallery. The page sits in the shell's px-5 container, so the
            strip pulls itself out to the viewport edges. */}
        <div className="relative -mx-5">
          <div
            ref={stripRef}
            onScroll={handleStripScroll}
            className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none"
          >
            {images.length > 0 ? (
              images.map((image, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => openFullscreenAt(index)}
                  aria-label={`Open photo ${index + 1} of ${images.length}`}
                  className="photo-panel relative aspect-[4/5] w-full shrink-0 cursor-zoom-in snap-start"
                >
                  <Image
                    src={image}
                    alt={`${listing.listing_title} - Image ${index + 1}`}
                    fill
                    sizes={GALLERY_SIZES}
                    className="object-cover"
                    priority={index === 0}
                    loading={index === 0 ? undefined : 'lazy'}
                    quality={85}
                  />
                </button>
              ))
            ) : (
              <div className="photo-panel relative aspect-[4/5] w-full shrink-0">
                <span className="label-mono absolute inset-0 flex items-center justify-center text-foreground/45">
                  No photo
                </span>
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="label-mono absolute right-3 bottom-3 bg-foreground/85 px-2.5 py-1.5 text-background">
              {currentImageIndex + 1} / {images.length}
            </div>
          )}
        </div>

        {images.length > 1 && (
          <>
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex flex-1 gap-[5px]" aria-hidden>
                {Array.from({ length: barCount }, (_, i) => (
                  <span
                    key={i}
                    className={cn('h-1 max-w-[18px] flex-1', i === activeBar ? 'bg-primary' : 'bg-foreground/20')}
                  />
                ))}
              </div>
              <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.1em] text-foreground/50">
                Swipe · tap to open
              </span>
            </div>

            <div ref={phoneThumbRef} className="mt-3 flex snap-x snap-mandatory gap-1.5 overflow-x-auto scrollbar-none">
              {images.map((image, index) => {
                const active = index === currentImageIndex;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => scrollStripTo(index)}
                    aria-label={`Show photo ${index + 1}`}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'photo-panel relative h-[70px] w-14 shrink-0 cursor-pointer snap-start overflow-hidden',
                      active ? 'border-2 border-primary' : 'border border-foreground/15'
                    )}
                  >
                    <Image src={image} alt="" fill sizes="56px" className="object-cover" />
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-6">
          {listing.disabled && (
            <StateBlock variant="success" label="Sold" className="mb-4">
              This guitar has found a new home.
            </StateBlock>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {listing.condition && <span className="label-mono text-primary">Used · {listing.condition}</span>}
            {isOnSale && (
              <span className="label-mono-sm bg-primary px-2 py-1 text-primary-foreground">On sale</span>
            )}
            {isReserved && (
              <span className="label-mono-sm bg-muted-foreground px-2 py-1 text-foreground">
                {listing.reservation_badge || 'On hold'}
              </span>
            )}
            {listing.disabled && (
              <span className="label-mono-sm bg-foreground px-2 py-1 text-background">Sold</span>
            )}
          </div>

          <h1 className="mt-3 font-heading text-[30px] leading-[0.98] text-pretty text-foreground">
            {listing.listing_title}
          </h1>

          <div className="mt-4 flex items-baseline gap-2.5">
            <span className="font-heading text-[30px] leading-none text-foreground">
              {formatPrice(listing.price, listing.currency)}
            </span>
            {isOnSale && (
              <span className="text-[15px] text-muted-foreground line-through">
                {formatPrice(listing.original_price!, listing.currency)}
              </span>
            )}
          </div>
          <p className="label-mono mt-2 text-primary">Free insured shipping · Out in one business day</p>
        </div>

        {/* Reserved for this user — show their terms and the right next step. */}
        {myReservation && (
          <div className="mt-4">
            <ReservationBanner reservation={myReservation} onAddToCart={handleAddToCart} inCart={inCart} />
          </div>
        )}

        {!listing.disabled && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-12 px-2 text-center text-[13px] leading-[1.15] whitespace-normal"
              onClick={handleMakeOffer}
              disabled={blockedByHold}
              title={blockedByHold ? 'This guitar is currently on hold and not accepting offers.' : undefined}
            >
              {blockedByHold ? 'Not accepting offers' : existingOfferConversationId ? 'View offer(s)' : 'Make an offer'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-12 px-2 text-center text-[13px] leading-[1.15] whitespace-normal"
              onClick={handleMessageSeller}
              disabled={isMessageLoading}
            >
              {isMessageLoading ? 'Opening...' : 'Message Luke'}
            </Button>
          </div>
        )}

        {/* Explanation for anyone who isn't the holder. */}
        {blockedByHold && <p className="mt-3 text-sm leading-[1.45] text-foreground/65">{holdMessage}</p>}

        <div className="mt-6">
          <CollapsibleSection title="Specs" defaultOpen>
            <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-5 gap-y-2.5 text-[15px] leading-[1.4] text-foreground">
              {listing.condition && (
                <>
                  <dt className="label-mono-sm tracking-[0.12em] text-foreground/55">Condition</dt>
                  <dd>{listing.condition}</dd>
                </>
              )}
              <dt className="label-mono-sm tracking-[0.12em] text-foreground/55">Listed</dt>
              <dd>{listedOn}</dd>
              <dt className="label-mono-sm tracking-[0.12em] text-foreground/55">Photos</dt>
              <dd>{images.length}</dd>
              {listing.reverb_link && (
                <>
                  <dt className="label-mono-sm tracking-[0.12em] text-foreground/55">Source</dt>
                  <dd>
                    <a
                      href={listing.reverb_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center text-primary underline underline-offset-2"
                    >
                      View on Reverb
                    </a>
                  </dd>
                </>
              )}
            </dl>
          </CollapsibleSection>

          {sanitizedDescription && (
            <CollapsibleSection title="Description">
              <div className={DESCRIPTION_PROSE} dangerouslySetInnerHTML={{ __html: sanitizedDescription }} />
            </CollapsibleSection>
          )}

          <CollapsibleSection title="Shipping & returns">
            <div className="space-y-4">
              {SHIPPING_TERMS.map((term) => (
                <div key={term.head}>
                  <p className="text-[15px] leading-[1.5] font-semibold text-foreground">{term.head}</p>
                  <p className="text-[15px] leading-[1.5] text-foreground/78">{term.body}</p>
                </div>
              ))}
              <Link
                href="/shop-info?tab=return-policy"
                className="label-mono-sm inline-flex h-12 items-center text-primary underline-offset-4 hover:underline"
              >
                Full terms on Shop Info →
              </Link>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Reviews" className="border-b border-foreground/15">
            <ReviewsCarousel variant="list" />
          </CollapsibleSection>
        </div>

        {/* Owner tools. Downloading the photo set and copying the listing text are for
            relisting, not for buying, so customers never see them. */}
        {isAdmin && (
          <div className="mt-6">
            <p className="label-mono text-foreground/50">Shop tools</p>
            <div className="mt-2.5 flex flex-wrap gap-2.5">
              {images.length > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadPhotos}
                  disabled={isDownloading}
                  className="h-11 cursor-pointer border border-foreground/25 px-3.5 text-sm text-foreground/70 disabled:opacity-50"
                >
                  {isDownloading ? 'Downloading...' : `Download photos (${images.length})`}
                </button>
              )}
              <button
                type="button"
                onClick={copyTitle}
                className="h-11 cursor-pointer border border-foreground/25 px-3.5 text-sm text-foreground/70"
              >
                {titleCopied ? 'Title copied' : 'Copy title'}
              </button>
              {listing.description && (
                <button
                  type="button"
                  onClick={handleCopyDescription}
                  className="h-11 cursor-pointer border border-foreground/25 px-3.5 text-sm text-foreground/70"
                >
                  {descriptionCopied ? 'Description copied' : 'Copy description'}
                </button>
              )}
            </div>
          </div>
        )}

        <StickyBar className="grid grid-cols-[auto_1fr_auto] gap-2.5">
          <div>
            <p className="font-heading text-[22px] leading-none text-foreground">
              {formatPrice(listing.price, listing.currency)}
            </p>
            <p className="label-mono-sm mt-0.5 text-primary">Free shipping</p>
          </div>
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={addDisabled}
            title={blockedByHold ? holdMessage : undefined}
            className={cn(
              'font-btn flex h-12 items-center justify-center px-3 text-[13px] transition-colors',
              addDisabled
                ? 'cursor-not-allowed border border-foreground/30 bg-transparent text-foreground/40'
                : 'cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            {listing.disabled
              ? 'Sold'
              : blockedByHold
                ? listing.reservation_badge || 'On hold'
                : inCart
                  ? justAdded
                    ? 'Added to cart'
                    : 'In cart'
                  : 'Add to cart'}
          </button>
          <button
            type="button"
            onClick={handleToggleFavorite}
            disabled={isFavoriteLoading}
            aria-pressed={isFavorite}
            aria-label={favoriteLabel}
            title={favoriteLabel}
            className="flex h-12 w-12 cursor-pointer items-center justify-center border-[1.5px] border-foreground text-primary transition-colors hover:bg-primary/8 disabled:opacity-50"
          >
            <Heart className={cn('h-5 w-5', isFavorite && 'fill-current')} />
          </button>
        </StickyBar>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Desktop composition (md and up) — the two-column page as it was.     */}
      {/* ------------------------------------------------------------------ */}
      <div className="hidden md:block">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center text-foreground hover:text-primary mb-6 transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Left side - Image carousel */}
        <div className="space-y-4">
          {/* Download Photos button — an owner tool, so only the admin session sees it */}
          {isAdmin && images.length > 0 && (
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
          <div className="relative aspect-square bg-card rounded-lg overflow-hidden border border-border">
            {images.length > 0 ? (
              <>
                <Image
                  src={images[currentImageIndex]}
                  alt={`${listing.listing_title} - Image ${currentImageIndex + 1}`}
                  fill
                  sizes={GALLERY_SIZES}
                  className="object-contain cursor-zoom-in"
                  priority
                  quality={85}
                  onClick={() => setIsFullscreen(true)}
                />
                {/* Navigation arrows */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={goToPrevious}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-card/90 hover:bg-card rounded-full p-2 transition-all cursor-pointer"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="h-6 w-6 text-foreground" />
                    </button>
                    <button
                      onClick={goToNext}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-card/90 hover:bg-card rounded-full p-2 transition-all cursor-pointer"
                      aria-label="Next image"
                    >
                      <ChevronRight className="h-6 w-6 text-foreground" />
                    </button>
                  </>
                )}
                {/* Image counter */}
                {images.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-foreground/70 text-primary-foreground text-sm px-3 py-1">
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
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <Image
                    src={image}
                    alt={`Thumbnail ${index + 1}`}
                    fill
                    sizes="80px"
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
            <StateBlock variant="success" label="Sold">
              This guitar has found a new home.
            </StateBlock>
          )}

          {/* Condition badge */}
          {listing.condition && (
            <div className="text-sm font-semibold text-primary">
              Used - {listing.condition}
            </div>
          )}

          {/* Title */}
          <div className="flex items-start gap-2">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground leading-tight">
              {listing.listing_title}
            </h1>
            {isAdmin && (
              <button
                onClick={copyTitle}
                className="p-1.5 text-foreground/40 hover:text-foreground/65 transition-colors flex-shrink-0 mt-1"
                title="Copy title"
              >
                {titleCopied ? (
                  <Check className="h-5 w-5 text-primary" />
                ) : (
                  <Copy className="h-5 w-5" />
                )}
              </button>
            )}
          </div>

          {/* Price section */}
          <div className="border-t border-b border-border py-6">
            {isOnSale ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-primary text-primary-foreground text-sm font-bold px-2 py-1 rounded">
                    ON SALE
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-primary">
                    {formatPrice(listing.price, listing.currency)}
                  </span>
                  <span className="text-xl text-muted-foreground line-through">
                    {formatPrice(listing.original_price!, listing.currency)}
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
            <p className="label-mono text-primary mt-1">Free shipping</p>
          </div>

          {/* Reserved for this user — show their terms and the right next step. */}
          {myReservation && (
            <ReservationBanner
              reservation={myReservation}
              onAddToCart={handleAddToCart}
              inCart={inCart}
            />
          )}

          {/* Add to cart and favorite buttons */}
          <div className="flex gap-3">
            <Button
              className={`flex-1 font-semibold py-6 text-lg transition-all ${
                listing.disabled
                  ? 'bg-muted-foreground text-foreground cursor-not-allowed'
                  : blockedByHold
                  ? 'bg-muted-foreground text-foreground cursor-not-allowed'
                  : inCart
                  ? 'bg-foreground hover:bg-foreground/90 text-background'
                  : 'bg-primary hover:bg-primary/90 text-primary-foreground'
              }`}
              onClick={handleAddToCart}
              disabled={inCart || listing.disabled || blockedByHold}
              title={blockedByHold ? holdMessage : undefined}
            >
              {listing.disabled ? (
                'SOLD'
              ) : blockedByHold ? (
                listing.reservation_badge || 'On Hold'
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
                  ? 'text-primary border-primary hover:bg-primary/8 hover:text-primary'
                  : 'text-muted-foreground hover:text-primary hover:border-primary hover:bg-transparent'
              }`}
              onClick={handleToggleFavorite}
              disabled={isFavoriteLoading}
              title={favoriteLabel}
            >
              <Heart className={`h-6 w-6 ${isFavorite ? 'fill-current' : ''}`} />
            </Button>
          </div>

          {/* Hover/tap explanation for anyone who isn't the holder. */}
          {blockedByHold && (
            <p className="text-sm text-muted-foreground">
              {holdMessage}
            </p>
          )}

          {/* Make Offer and Message Seller buttons */}
          {!listing.disabled && (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1 py-6 text-lg"
                onClick={handleMakeOffer}
                disabled={blockedByHold}
                title={
                  blockedByHold
                    ? 'This guitar is currently on hold and not accepting offers.'
                    : undefined
                }
              >
                <Tag className="h-5 w-5 mr-2" />
                {blockedByHold
                  ? 'Not accepting offers'
                  : existingOfferConversationId
                  ? 'View Offer(s)'
                  : 'Make an Offer'}
              </Button>
              <Button
                variant="outline"
                className="flex-1 py-6 text-base sm:text-lg"
                onClick={handleMessageSeller}
                disabled={isMessageLoading}
              >
                <MessageSquare className="h-5 w-5 mr-2" />
                {isMessageLoading ? 'Opening...' : "Message Luke"}
              </Button>
            </div>
          )}

          {/* Description section */}
          {sanitizedDescription && (
            <div className="pt-6 border-t border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Description</h2>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyDescription}
                    className="text-foreground hover:text-primary"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    {descriptionCopied ? 'Copied!' : 'Copy'}
                  </Button>
                )}
              </div>
              <div
                className={DESCRIPTION_PROSE}
                dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
              />
            </div>
          )}

          {/* Additional details */}
          <div className="pt-6 border-t border-border text-sm text-foreground flex items-center justify-between">
            <p>Listed on {listedOn}</p>
            {listing.reverb_link && (
              <a
                href={listing.reverb_link}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-primary transition-colors cursor-pointer"
              >
                View on Reverb
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Reviews Carousel */}
      <ReviewsCarousel />
      </div>

      {/* Fullscreen image overlay */}
      {isFullscreen && images.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-foreground/90 flex items-center justify-center"
          onClick={() => setIsFullscreen(false)}
        >
          {/* Close button */}
          <button
            className="absolute top-4 right-4 flex h-11 w-11 items-center justify-center text-background bg-foreground/50 hover:bg-foreground/80 rounded-full transition-colors cursor-pointer md:h-auto md:w-auto md:p-2"
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
              sizes="90vw"
              className="object-contain"
              quality={100}
            />
          </div>

          {/* Prev/Next arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-foreground/50 hover:bg-foreground/80 rounded-full p-3 text-background transition-colors cursor-pointer"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-7 w-7" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); goToNext(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-foreground/50 hover:bg-foreground/80 rounded-full p-3 text-background transition-colors cursor-pointer"
                aria-label="Next image"
              >
                <ChevronRight className="h-7 w-7" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-foreground/50 text-background text-sm px-3 py-1">
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
