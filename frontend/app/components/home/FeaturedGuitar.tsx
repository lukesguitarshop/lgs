import Image from 'next/image';
import Link from 'next/link';
import { formatPrice } from '@/lib/format';

export interface FeaturedListing {
  id: string;
  listing_title: string;
  condition: string | null;
  images: string[];
  price: number;
  original_price: number | null;
  currency: string;
  is_reserved?: boolean;
  reservation_badge?: string | null;
}

interface FeaturedGuitarProps {
  listing: FeaturedListing;
}

/**
 * Sits directly under the record card in the hero's right column, so it is built to the
 * same narrow width rather than reusing the grid card.
 */
export default function FeaturedGuitar({ listing }: FeaturedGuitarProps) {
  const isOnSale = Boolean(listing.original_price && listing.price < listing.original_price);

  return (
    <Link
      href={`/listing/${listing.id}`}
      className="group block border border-foreground/22 bg-background transition-colors hover:border-primary cursor-pointer"
    >
      <p className="label-mono-sm flex items-center gap-2 border-b border-foreground/14 px-3 py-2 text-primary">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
        Featured
      </p>

      <div className="photo-panel relative aspect-[4/3] w-full">
        {listing.images?.[0] ? (
          <Image
            src={listing.images[0]}
            alt={listing.listing_title}
            fill
            sizes="290px"
            className="object-cover"
          />
        ) : (
          <span className="label-mono-sm absolute inset-0 flex items-center justify-center text-foreground/45">
            No photo
          </span>
        )}

        {listing.is_reserved ? (
          <span className="absolute top-0 right-0 bg-yellow-400 px-2 py-1 font-heading text-[11px] leading-none text-yellow-900">
            {listing.reservation_badge || 'On Hold'}
          </span>
        ) : (
          isOnSale && (
            <span className="absolute top-0 right-0 bg-primary px-2 py-1 font-heading text-[11px] leading-none text-primary-foreground">
              On sale
            </span>
          )
        )}
      </div>

      <div className="px-3 pt-2.5 pb-3">
        {listing.condition && (
          <p className="label-mono-sm mb-1 text-foreground/62">Used · {listing.condition}</p>
        )}
        <h3 className="mb-1.5 line-clamp-2 font-heading text-[15px] leading-[1.1] text-foreground transition-colors group-hover:text-primary">
          {listing.listing_title}
        </h3>
        <p className="flex items-baseline gap-2">
          <span className={`font-heading text-[19px] ${isOnSale ? 'text-primary' : 'text-foreground'}`}>
            {formatPrice(listing.price, listing.currency)}
          </span>
          {isOnSale && (
            <span className="text-xs text-foreground/50 line-through">
              {formatPrice(listing.original_price!, listing.currency)}
            </span>
          )}
        </p>
      </div>
    </Link>
  );
}
