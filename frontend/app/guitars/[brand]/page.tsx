import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ListingCard, type ListingCardData } from '@/components/listing/ListingCard';
import {
  getActiveListings,
  getSoldListings,
  isIndexableBrand,
  listingsForBrand,
  summarizeBrands,
  type CatalogListing,
} from '@/lib/catalog';
import { formatPrice } from '@/lib/format';
import { SITE_NAME, brandFromSlug, brandPath, getSiteUrl, listingPath } from '@/lib/seo';

/**
 * One page per maker: every guitar of that brand for sale now, then what the shop
 * has already sold. It exists so a search like "used PRS guitars" has a page to land
 * on; the homepage lists everything and ranks for nothing that specific.
 */

const SOLD_SHOWN = 12;

interface PageProps {
  params: Promise<{ brand: string }>;
}

async function loadBrand(slug: string) {
  const brand = brandFromSlug(slug);
  if (!brand) return null;

  const [active, sold] = await Promise.all([getActiveListings(), getSoldListings()]);
  const inStock = listingsForBrand(active, brand);
  const soldOfBrand = listingsForBrand(sold, brand);
  if (inStock.length === 0 && soldOfBrand.length === 0) return null;

  const otherBrands = summarizeBrands(active, sold).filter(
    (summary) => summary.brand !== brand && isIndexableBrand(summary),
  );
  return { brand, inStock, sold: soldOfBrand, otherBrands };
}

function guitars(n: number): string {
  return n === 1 ? '1 guitar' : `${n} guitars`;
}

function toCardData(listing: CatalogListing): ListingCardData {
  return {
    id: listing.id,
    title: listing.listing_title,
    condition: listing.condition,
    images: listing.images,
    price: listing.price,
    originalPrice: listing.original_price ?? null,
    currency: listing.currency,
    isReserved: listing.is_reserved,
    reservationBadge: listing.reservation_badge,
  };
}

export async function generateMetadata({ params }: PageProps) {
  const { brand: slug } = await params;
  const data = await loadBrand(slug);
  if (!data) return { title: 'Brand not found' };

  const { brand, inStock, sold } = data;
  const stockLine =
    inStock.length > 0
      ? `${guitars(inStock.length)} in stock from ${formatPrice(Math.min(...inStock.map((l) => l.price)))}`
      : 'None in stock right now';
  const soldLine = sold.length > 0 ? ` ${sold.length} sold so far.` : '';
  const description = `Used ${brand} guitars at ${SITE_NAME}. ${stockLine}.${soldLine} 14+ photos of the exact guitar, every flaw disclosed, free insured shipping.`;
  const cover = inStock[0]?.images[0] ?? sold[0]?.images[0];

  return {
    title: `Used ${brand} Guitars for Sale`,
    description,
    alternates: { canonical: brandPath(brand) },
    openGraph: {
      title: `Used ${brand} Guitars for Sale | ${SITE_NAME}`,
      description,
      url: brandPath(brand),
      ...(cover && { images: [{ url: cover, alt: `Used ${brand} guitars` }] }),
    },
    robots: {
      index: isIndexableBrand({ brand, inStock: inStock.length, sold: sold.length }),
      follow: true,
    },
  };
}

export default async function BrandPage({ params }: PageProps) {
  const { brand: slug } = await params;
  const data = await loadBrand(slug);
  if (!data) notFound();

  const { brand, inStock, sold, otherBrands } = data;
  const siteUrl = getSiteUrl();
  const soldShown = sold.slice(0, SOLD_SHOWN);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: 'Guitars by brand', item: `${siteUrl}/guitars` },
          {
            '@type': 'ListItem',
            position: 3,
            name: `${brand} guitars`,
            item: `${siteUrl}${brandPath(brand)}`,
          },
        ],
      },
      {
        '@type': 'ItemList',
        name: `Used ${brand} guitars for sale`,
        numberOfItems: inStock.length,
        itemListElement: inStock.map((listing, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: listing.listing_title,
          url: `${siteUrl}${listingPath(listing.id, listing.listing_title)}`,
        })),
      },
    ],
  };

  return (
    <div className="mx-auto max-w-[1320px] px-5 pt-8 pb-12 md:pt-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      <nav aria-label="Breadcrumb" className="label-mono-sm text-foreground/60">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link href="/guitars" className="hover:text-primary">
          Brands
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{brand}</span>
      </nav>

      <h1 className="font-heading mt-4 text-3xl text-primary sm:text-5xl">Used {brand} guitars</h1>
      <p className="mt-4 max-w-[68ch] text-[17px] leading-[1.6] text-foreground/80">
        {inStock.length > 0
          ? `${guitars(inStock.length)} from ${brand} in stock right now.`
          : `No ${brand} guitars in stock right now.`}{' '}
        {sold.length > 0 && `${sold.length} sold through the shop so far. `}
        Every listing has 14 or more photos of the exact guitar you&apos;d be buying, every flaw is
        disclosed, and shipping is free and insured.
      </p>

      <section aria-labelledby="in-stock" className="mt-10">
        <h2 id="in-stock" className="font-heading text-[26px] leading-none md:text-[30px]">
          In stock
        </h2>
        {inStock.length > 0 ? (
          <div className="mt-5 grid grid-cols-1 gap-8 md:grid-cols-[repeat(auto-fill,minmax(268px,1fr))] md:gap-[clamp(20px,2.4vw,32px)]">
            {inStock.map((listing, index) => (
              <ListingCard key={listing.id} listing={toCardData(listing)} priority={index < 4} />
            ))}
          </div>
        ) : (
          <p className="mt-4 max-w-[68ch] text-foreground/75">
            Nothing from {brand} at the moment.{' '}
            <Link href="/#inventory" className="underline hover:text-primary">
              See everything in stock
            </Link>{' '}
            or{' '}
            <Link href="/contact" className="underline hover:text-primary">
              ask what&apos;s coming in
            </Link>
            .
          </p>
        )}
      </section>

      {soldShown.length > 0 && (
        <section aria-labelledby="sold" className="mt-14">
          <h2 id="sold" className="font-heading text-[26px] leading-none md:text-[30px]">
            Recently sold {brand}
          </h2>
          <p className="mt-2 text-foreground/70">
            What these have gone for here, with the photos they were sold on.
          </p>
          <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-7 md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
            {soldShown.map((listing) => (
              <li key={listing.id}>
                <Link href={listingPath(listing.id, listing.listing_title)} className="group block">
                  <div className="photo-panel relative aspect-square overflow-hidden border border-foreground/15">
                    {listing.images[0] && (
                      <Image
                        src={listing.images[0]}
                        alt={listing.listing_title}
                        fill
                        sizes="(max-width: 768px) 50vw, 220px"
                        className="object-cover"
                      />
                    )}
                    <span className="label-mono absolute top-0 left-0 bg-primary px-2 py-1 text-primary-foreground">
                      Sold
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold group-hover:text-primary">
                    {listing.listing_title}
                  </p>
                  <p className="mt-1 text-sm text-foreground/70">
                    {formatPrice(listing.price, listing.currency)}
                    {listing.condition ? ` · ${listing.condition}` : ''}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          {sold.length > soldShown.length && (
            <p className="mt-6">
              <Link href="/sold" className="underline hover:text-primary">
                See all sold guitars
              </Link>
            </p>
          )}
        </section>
      )}

      {otherBrands.length > 0 && (
        <section
          aria-labelledby="other-brands"
          className="mt-14 border-t border-foreground/15 pt-8"
        >
          <h2 id="other-brands" className="label-mono text-primary">
            Other brands
          </h2>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[15px]">
            {otherBrands.map((summary) => (
              <li key={summary.brand}>
                <Link href={brandPath(summary.brand)} className="underline hover:text-primary">
                  {summary.brand}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
