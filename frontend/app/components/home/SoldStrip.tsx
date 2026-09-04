import Image from 'next/image';
import Link from 'next/link';
import { formatPrice } from '@/lib/format';

export interface SoldStripListing {
  id: string;
  listing_title: string;
  images: string[];
  price: number;
  currency: string;
}

interface SoldStripProps {
  listings: SoldStripListing[];
  totalSold: number;
}

export default function SoldStrip({ listings, totalSold }: SoldStripProps) {
  if (listings.length === 0) return null;

  return (
    <section id="sold" className="order-4 md:order-none">
      {/* Desktop first in the DOM so the e2e suite's "first listing link" never resolves
          to a hidden phone stub. Only one block displays at any width. */}
      <div className="mx-auto hidden max-w-[1440px] px-5 py-[clamp(48px,6vw,88px)] md:block">
        <div className="mb-[clamp(22px,3vw,34px)] flex flex-wrap items-end justify-between gap-6 border-b-2 border-primary pb-[clamp(18px,2.4vw,26px)]">
          <div className="max-w-[56ch]">
            <p className="label-mono mb-3.5 text-primary">The track record</p>
            <h2 className="font-heading text-[clamp(30px,4.6vw,54px)]">
              {totalSold} sold. Here are the last {listings.length}.
            </h2>
            <p className="mt-3.5 text-[clamp(15px,1.4vw,17px)] leading-[1.55] text-foreground/68">
              Every one shipped free and insured, described honestly, and rated highly on the way out.
              This is the part a marketplace listing can&apos;t show you.
            </p>
          </div>
          <Link
            href="/sold"
            className="btn-mono min-h-[46px] border border-foreground/35 px-[17px] py-[13px] text-[11px] tracking-[0.12em] whitespace-nowrap text-foreground hover:border-primary hover:text-primary cursor-pointer"
          >
            All {totalSold} sold →
          </Link>
        </div>

        <ol className="m-0 grid list-none gap-0 p-0">
          {listings.map(listing => (
            <li
              key={listing.id}
              className="flex flex-wrap items-center gap-[clamp(14px,2vw,26px)] border-b border-foreground/14 py-3.5"
            >
              <span className="photo-panel relative block h-[74px] w-[74px] flex-none border border-foreground/16">
                {listing.images?.[0] && (
                  <Image
                    src={listing.images[0]}
                    alt={listing.listing_title}
                    fill
                    sizes="74px"
                    className="object-cover"
                  />
                )}
              </span>
              <span className="label-mono-sm flex-none border border-primary bg-primary px-[7px] py-1 text-primary-foreground">
                Sold
              </span>
              <Link
                href={`/listing/${listing.id}`}
                className="min-w-0 flex-[1_1_260px] text-[clamp(14.5px,1.3vw,16px)] leading-[1.4] text-foreground transition-colors hover:text-primary cursor-pointer"
              >
                {listing.listing_title}
              </Link>
              <span className="min-w-[78px] text-right font-heading text-[19px] text-foreground/55">
                {formatPrice(listing.price, listing.currency)}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* Phone: a snap-scrolling strip of 120px stubs instead of eight full-width rows.
          scroll-pl matches the gutter so a snapped stub lands at 20px, not flush left. */}
      <div className="pt-8 md:hidden">
        <div className="flex items-baseline justify-between px-5 pb-3.5">
          <h2 className="font-heading text-[26px] leading-none">Recently sold</h2>
          {/* Padding grows the tap target to 44px; the negative margin keeps it from
              pushing the strip down. */}
          <Link href="/sold" className="label-mono -my-4 py-4 text-primary">
            All {totalSold} →
          </Link>
        </div>
        <ol className="m-0 flex list-none gap-2.5 overflow-x-auto scroll-pl-5 px-5 pb-1 snap-x snap-mandatory scrollbar-none">
          {listings.map(listing => (
            <li key={listing.id} className="w-[120px] shrink-0 snap-start">
              <Link href={`/listing/${listing.id}`} className="block">
                <span className="photo-panel relative block aspect-[4/5] border border-foreground/15">
                  {listing.images?.[0] && (
                    <Image
                      src={listing.images[0]}
                      alt={listing.listing_title}
                      fill
                      sizes="120px"
                      className="object-cover"
                    />
                  )}
                </span>
                <span className="label-mono-sm mt-2 block text-primary">
                  Sold {formatPrice(listing.price, listing.currency)}
                </span>
                <span className="mt-1 line-clamp-2 block text-[13px] leading-[1.3] text-foreground">
                  {listing.listing_title}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
