'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { addToCart, isInCart } from '@/lib/cart';
import { logAddToCart } from '@/lib/activity';
import { trackAddToCart } from '@/lib/analytics';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

/** The card's own view of a listing. Callers map their API shape onto this. */
export interface ListingCardData {
  id: string;
  title: string;
  condition: string | null;
  images: string[];
  price: number;
  originalPrice: number | null;
  currency: string;
  /** True when an active reservation holds this guitar. Never says who. */
  isReserved?: boolean;
  /** "On Hold" or "Pending Trade-In". */
  reservationBadge?: string | null;
  reservedForMe?: boolean;
}

interface ListingCardProps {
  listing: ListingCardData;
  isFavorite?: boolean;
  /** Omit to render the card without a heart. */
  onToggleFavorite?: (listingId: string, e: React.MouseEvent) => void;
  /** Eager-load the photo — the first few cards above the fold. */
  priority?: boolean;
  className?: string;
}

/**
 * The listing card — the single most-repeated component on the site, shared by the
 * inventory grid and the favourites page.
 *
 * Phone composition (base classes): a 4:5 photo with square corners and a hairline
 * border, badges flush in the photo's bottom corners, a 44px favourite target, mono
 * crimson condition, a title that wraps rather than truncates, an Anton price with
 * "Free shipping" as a mono label, and a 48px action row where "Add to cart" is the one
 * solid crimson button and "Details" is outline. From `md:` up the `md:` classes restore
 * the desktop card exactly as it rendered before the mobile revamp — square photo, 42px
 * equal-weight outline actions, Archivo bold price — so desktop does not regress.
 *
 * The whole card is a link to the listing. "Details" is therefore a span, not a nested
 * anchor, and "Add to cart" stops the click before it navigates.
 */
export function ListingCard({
  listing,
  isFavorite = false,
  onToggleFavorite,
  priority = false,
  className,
}: ListingCardProps) {
  const isOnSale = Boolean(listing.originalPrice && listing.price < listing.originalPrice);
  const isReserved = Boolean(listing.isReserved);
  const photoCount = listing.images?.length ?? 0;
  const [inCart, setInCart] = useState(false);

  // localStorage is read after mount only: reading it during render would make the
  // server and client markup disagree.
  useEffect(() => {
    const sync = () => setInCart(isInCart(listing.id));
    sync();
    window.addEventListener('cartUpdated', sync);
    return () => window.removeEventListener('cartUpdated', sync);
  }, [listing.id]);

  const handleAddToCart = (e: React.MouseEvent) => {
    // The whole card is a link; keep the click from navigating.
    e.preventDefault();
    e.stopPropagation();
    if (isReserved || inCart) return;

    addToCart({
      id: listing.id,
      title: listing.title,
      price: listing.price,
      currency: listing.currency,
      image: listing.images?.[0] || '',
    });
    logAddToCart(listing.id, listing.title);
    trackAddToCart({
      id: listing.id,
      name: listing.title,
      price: listing.price,
      currency: listing.currency,
    });
    setInCart(true);
  };

  const addDisabled = isReserved || inCart;
  const actionBase =
    'font-btn flex h-12 items-center justify-center px-3 text-center text-[13px] transition-colors md:h-[42px] md:text-xs md:font-bold md:tracking-wider';

  return (
    <Link href={`/listing/${listing.id}`} className={cn('group block h-full', className)}>
      <article className="flex h-full flex-col md:border md:border-border md:bg-card">
        <div className="photo-panel relative aspect-[4/5] w-full overflow-hidden border border-foreground/15 md:aspect-square md:border-0">
          {photoCount > 0 ? (
            <Image
              src={listing.images[0]}
              alt={listing.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
              className="object-cover"
              priority={priority}
            />
          ) : (
            <span className="label-mono-sm absolute inset-0 flex items-center justify-center text-foreground/45">
              No photo
            </span>
          )}

          {/* Badges sit flush in the photo's bottom corners on phones, inset at the top
              on desktop. A reserved guitar stays browsable — the badge creates urgency —
              but never reveals who it is held for. */}
          {isReserved ? (
            <span
              className={cn(
                'label-mono absolute bottom-0 left-0 px-2.5 py-1.5 md:top-2 md:left-2 md:bottom-auto',
                listing.reservedForMe
                  ? 'bg-foreground text-background'
                  : 'bg-muted-foreground text-foreground'
              )}
            >
              {listing.reservedForMe ? 'On hold for you' : listing.reservationBadge || 'On hold'}
            </span>
          ) : (
            isOnSale && (
              <span className="label-mono absolute bottom-0 left-0 bg-primary px-2.5 py-1.5 text-primary-foreground md:top-2 md:left-2 md:bottom-auto">
                On sale
              </span>
            )
          )}
          {photoCount > 1 && (
            <span className="label-mono absolute right-0 bottom-0 bg-foreground px-2.5 py-1.5 text-background md:right-2 md:bottom-2">
              {photoCount} photos
            </span>
          )}

          {onToggleFavorite && (
            <button
              type="button"
              onClick={e => onToggleFavorite(listing.id, e)}
              aria-pressed={isFavorite}
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              className={cn(
                'absolute top-2.5 right-2.5 flex h-11 w-11 cursor-pointer items-center justify-center border transition-colors',
                isFavorite
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-foreground/20 bg-background/92 text-primary hover:bg-background'
              )}
            >
              <Heart className={cn('h-5 w-5', isFavorite && 'fill-current')} />
            </button>
          )}
        </div>

        <div className="flex flex-1 flex-col pt-3 md:p-4">
          {listing.condition && (
            <p className="label-mono text-primary md:mb-1 md:font-sans md:text-sm md:normal-case md:tracking-normal md:text-muted-foreground">
              Used · {listing.condition}
            </p>
          )}
          <h3 className="mt-1.5 text-[17px] leading-[1.3] font-semibold text-pretty text-foreground transition-colors group-hover:text-primary md:mt-0 md:mb-2 md:line-clamp-2 md:text-lg md:leading-snug">
            {listing.title}
          </h3>

          <div className="mt-2.5 flex items-baseline justify-between gap-3 md:mt-0 md:mb-3 md:block">
            <p className="flex items-baseline gap-2">
              <span
                className={cn(
                  'font-heading text-2xl leading-none md:font-sans md:leading-normal md:font-bold md:tracking-normal',
                  isOnSale ? 'md:text-primary' : 'md:text-foreground'
                )}
              >
                {formatPrice(listing.price, listing.currency)}
              </span>
              {isOnSale && (
                <span className="text-sm text-muted-foreground line-through md:text-lg">
                  {formatPrice(listing.originalPrice!, listing.currency)}
                </span>
              )}
            </p>
            <p className="label-mono shrink-0 text-primary md:mt-1">Free shipping</p>
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-2 md:mt-auto">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={addDisabled}
              className={cn(
                actionBase,
                addDisabled
                  ? 'cursor-not-allowed border border-foreground/30 bg-transparent text-foreground/40'
                  : 'cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 md:border md:border-foreground md:bg-background md:text-foreground md:hover:bg-foreground md:hover:text-background'
              )}
            >
              {isReserved ? 'Reserved' : inCart ? 'In cart' : 'Add to cart'}
            </button>
            <span
              className={cn(
                actionBase,
                'border border-foreground bg-transparent text-foreground group-hover:bg-foreground group-hover:text-background'
              )}
            >
              <span className="md:hidden">Details</span>
              <span className="hidden md:inline">View Details</span>
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
