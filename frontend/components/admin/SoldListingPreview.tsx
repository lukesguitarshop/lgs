'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getReverbListing } from '@/lib/api';
import { htmlToPlainText } from '@/lib/html-text';
import type { ReverbListingPreview } from '@/lib/types/product-price';
import { formatPrice } from './deal-finder-shared';
import { RepairFlag } from './SoldHistory';

// reverb.com swaps a sold listing's page for "That listing sold", so the sold-history
// table shows the listing here instead: photos, what it was listed at, and the description.

// Sold listings don't change - keep what's been loaded for the rest of the visit
const cache = new Map<string, ReverbListingPreview>();

export function SoldListingPreview({ listingId, soldFor }: { listingId: string; soldFor: number }) {
  const [listing, setListing] = useState<ReverbListingPreview | null>(cache.get(listingId) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);

  useEffect(() => {
    if (cache.has(listingId)) return;
    let cancelled = false;
    getReverbListing(listingId)
      .then(res => {
        cache.set(listingId, res);
        if (!cancelled) setListing(res);
      })
      .catch((err: { message?: string }) => !cancelled && setError(err?.message ?? 'Failed to load the listing'));
    return () => { cancelled = true; };
  }, [listingId]);

  if (error) return <p className="py-3 text-[13px] text-primary">{error}</p>;
  if (!listing) {
    return (
      <div className="flex items-center gap-2 py-4 text-[13px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading listing...
      </div>
    );
  }

  const description = listing.description ? htmlToPlainText(listing.description) : '';
  const details = [listing.condition, listing.year, listing.finish].filter(Boolean).join(' · ');
  const tookOffer = listing.listedPrice != null && Math.round(listing.listedPrice) !== Math.round(soldFor);

  return (
    <div className="py-3">
      {listing.photos.length > 0 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
          {listing.photos.map((photo, i) => (
            <a
              key={photo.thumb}
              href={photo.full ?? photo.thumb}
              target="_blank"
              rel="noopener noreferrer"
              className="block flex-shrink-0 border border-foreground/15"
              aria-label={`Photo ${i + 1} of ${listing.photos.length}, full size`}
            >
              {/* Reverb CDN thumbnails; plain img so a long strip doesn't go through the image optimizer */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.thumb} alt="" loading="lazy" className="h-24 w-24 object-cover sm:h-28 sm:w-28" />
            </a>
          ))}
        </div>
      )}

      <p className="mt-1 text-[14px] font-semibold text-foreground">{listing.title}</p>
      <p className="mt-0.5 text-[13px] text-foreground/80">
        Sold for <span className="font-medium text-foreground">{formatPrice(soldFor, listing.currency)}</span>
        {tookOffer && listing.listedPrice != null && (
          <span className="text-muted-foreground"> · listed at {formatPrice(listing.listedPrice, listing.currency)}</span>
        )}
        {details && <span className="text-muted-foreground"> · {details}</span>}
      </p>
      {listing.sellerName && <p className="label-mono-sm mt-1 text-muted-foreground">Sold by {listing.sellerName}</p>}
      <RepairFlag note={listing.repairNote} />

      {description && (
        <div className="mt-2">
          <p className={`whitespace-pre-line text-[13px] leading-relaxed text-foreground/80 ${showFullDescription ? '' : 'line-clamp-5'}`}>
            {description}
          </p>
          {description.length > 300 && (
            <button
              onClick={() => setShowFullDescription(v => !v)}
              className="label-mono-sm mt-1 cursor-pointer text-muted-foreground hover:text-foreground"
            >
              {showFullDescription ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
