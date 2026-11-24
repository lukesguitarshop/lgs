import { Fragment } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Print } from '@/components/brand/Print';
import { ListingCard, type ListingCardData } from '@/components/listing/ListingCard';
import { coverImages, priceBands, priceStats, type CatalogListing } from '@/lib/catalog';
import { formatPrice } from '@/lib/format';
import { getSiteUrl, listingPath } from '@/lib/seo';
import { cn } from '@/lib/utils';

/**
 * The page shared by a maker ("Gibson") and one of its models ("Gibson Les Paul"):
 * what is for sale now, what the shop's own sales say it is worth, and what has sold.
 * Every figure is computed from the listings handed in; nothing is written per page.
 */

const SOLD_SHOWN = 12;
/** Below this the price chart is a few lonely bars and says nothing. */
const MIN_SOLD_FOR_CHART = 5;

export interface ShowcaseLink {
  label: string;
  href: string;
  /** The small line under the label: "3 in stock", "12 sold". */
  note: string;
}

export interface ShowcaseProps {
  /** How the subject reads in a sentence: "Gibson", "Gibson Les Paul". */
  name: string;
  /** The poster word: "Gibson", "Les Paul". */
  headline: string;
  /** The small label over the headline: "Used", "Used Gibson". */
  kicker: string;
  /** This page's own path. */
  path: string;
  /** Breadcrumb steps between Home and this page. */
  trail: { label: string; href: string }[];
  inStock: CatalogListing[];
  sold: CatalogListing[];
  linkSections: { title: string; links: ShowcaseLink[] }[];
}

export function guitars(n: number): string {
  return n === 1 ? '1 guitar' : `${n} guitars`;
}

/**
 * The headline is sized for a short maker's name. A longer one ("Stratocaster") is
 * scaled down by its length so it stays on the page instead of running off it.
 */
function headlineSize(headline: string): string {
  const scale = Math.min(1, 8.5 / headline.length);
  const px = (n: number) => `${Math.round(n * scale)}px`;
  return `clamp(${px(60)}, ${(12.5 * scale).toFixed(2)}vw, ${px(168)})`;
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

/** One line of the hero's record card. */
function RecordRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4',
        !last && 'border-b border-dashed border-foreground/28 pb-2.5',
      )}
    >
      <dt className="label-mono-sm text-foreground/60">{label}</dt>
      <dd className="m-0 font-heading text-[21px] leading-none whitespace-nowrap text-foreground md:text-[26px]">
        {value}
      </dd>
    </div>
  );
}

export function Showcase({
  name,
  headline,
  kicker,
  path,
  trail,
  inStock,
  sold,
  linkSections,
}: ShowcaseProps) {
  const siteUrl = getSiteUrl();
  const soldShown = sold.slice(0, SOLD_SHOWN);
  const stats = priceStats(sold);
  const bands = sold.length >= MIN_SOLD_FOR_CHART ? priceBands(sold) : null;
  const tallest = bands ? Math.max(...bands.map((band) => band.count)) : 0;
  // In-stock guitars lead the collage; sold ones fill it out.
  const prints = coverImages([...inStock, ...sold], 3);
  const fromPrice = inStock.length > 0 ? Math.min(...inStock.map((l) => l.price)) : null;

  const record: { label: string; value: string }[] = [
    { label: 'In stock', value: String(inStock.length) },
    { label: 'Sold here', value: String(sold.length) },
    ...(stats
      ? [
          { label: 'Typical price', value: formatPrice(stats.median) },
          { label: 'Range', value: `${formatPrice(stats.low)}–${formatPrice(stats.high)}` },
        ]
      : []),
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
          ...trail.map((crumb, index) => ({
            '@type': 'ListItem',
            position: index + 2,
            name: crumb.label,
            item: `${siteUrl}${crumb.href}`,
          })),
          {
            '@type': 'ListItem',
            position: trail.length + 2,
            name: `${name} guitars`,
            item: `${siteUrl}${path}`,
          },
        ],
      },
      {
        '@type': 'ItemList',
        name: `Used ${name} guitars for sale`,
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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      {/* ───────── Hero: navy band, the maker's name at poster size ───────── */}
      <section className="relative overflow-hidden bg-foreground text-background">
        <span
          aria-hidden
          className="ghost-word pointer-events-none absolute -right-[2vw] -bottom-[0.18em] font-heading text-[34vw] leading-none whitespace-nowrap select-none md:text-[24vw]"
        >
          {headline}
        </span>

        <div className="relative mx-auto grid max-w-[1320px] gap-10 px-5 pt-8 pb-12 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:gap-[clamp(32px,5vw,72px)] md:pt-12 md:pb-[clamp(56px,7vw,96px)]">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="label-mono-sm text-background/55">
              <Link href="/" className="transition-colors hover:text-background">
                Home
              </Link>
              <span className="mx-2">/</span>
              {trail.map((crumb) => (
                <Fragment key={crumb.href}>
                  <Link href={crumb.href} className="transition-colors hover:text-background">
                    {crumb.label}
                  </Link>
                  <span className="mx-2">/</span>
                </Fragment>
              ))}
              <span className="text-background">{headline}</span>
            </nav>

            <h1 className="rise mt-[clamp(22px,4vw,44px)]">
              <span className="label-mono flex items-center gap-3 text-muted-foreground">
                <span className="inline-block h-px w-[34px] bg-muted-foreground" />
                {kicker}
              </span>
              <span
                className="mt-3 block font-heading leading-[0.86] text-balance"
                style={{ fontSize: headlineSize(headline) }}
              >
                {headline}
              </span>
              <span className="mt-1 block font-heading text-[clamp(26px,4vw,52px)] leading-none text-muted-foreground">
                guitars
              </span>
            </h1>

            <p
              className="rise mt-6 max-w-[50ch] text-[clamp(16px,1.5vw,19px)] leading-[1.55] text-background/75"
              style={{ animationDelay: '90ms' }}
            >
              {inStock.length > 0
                ? `${inStock.length} ${name} ${inStock.length === 1 ? 'guitar' : 'guitars'} in stock right now${fromPrice !== null ? `, from ${formatPrice(fromPrice)}` : ''}.`
                : `No ${name} guitars in stock right now.`}{' '}
              {sold.length > 0 && `${sold.length} sold through the shop so far. `}
              Every one gets 14 or more photos of the exact guitar, every flaw disclosed, and free
              insured shipping.
            </p>

            <div
              className="rise mt-8 flex flex-wrap items-center gap-x-5 gap-y-3"
              style={{ animationDelay: '170ms' }}
            >
              <Link
                href={inStock.length > 0 ? '#in-stock' : '/#inventory'}
                className="btn-mono min-h-[52px] w-full border border-background bg-background px-[26px] py-4 text-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground sm:w-auto"
              >
                {inStock.length > 0 ? `See ${guitars(inStock.length)} in stock` : 'See everything in stock'}
              </Link>
              <Link
                href="/contact"
                className="inline-flex min-h-11 items-center border-b border-background/35 px-1 text-[15px] text-background/75 transition-colors hover:border-background hover:text-background"
              >
                Ask what&apos;s coming in →
              </Link>
            </div>
          </div>

          {/* Prints and the record card. The stage has a fixed aspect so the absolutely
              placed prints cannot push the hero's height around. */}
          <div
            className="rise relative mx-auto aspect-[5/4] w-full max-w-[560px] md:aspect-[1/1] md:self-center"
            style={{ animationDelay: '120ms' }}
          >
            {prints[2] && (
              <Print
                src={prints[2]}
                alt={`A used ${name} guitar from the shop`}
                className="top-[2%] right-[2%] z-0 aspect-square w-[42%] rotate-[5deg]"
              />
            )}
            {prints[1] && (
              <Print
                src={prints[1]}
                alt={`A used ${name} guitar from the shop`}
                className="right-[6%] bottom-[4%] z-10 hidden aspect-square w-[40%] -rotate-[4deg] md:block"
              />
            )}
            {prints[0] && (
              <Print
                src={prints[0]}
                alt={`Used ${name} guitar`}
                className="top-[8%] left-0 z-20 aspect-[4/5] w-[56%] -rotate-[2.5deg] md:w-[58%]"
                priority
              />
            )}

            <div className="receipt absolute right-[3%] bottom-0 z-30 w-[56%] max-w-[270px] rotate-[2deg] md:right-0 md:-bottom-[4%] md:w-[250px]">
              <div className="receipt-rule" />
              <div className="px-4 pt-3.5 pb-4">
                <p className="label-mono-sm mb-3 text-foreground/60">The {headline} record</p>
                <dl className="grid gap-2.5">
                  {record.map((row, index) => (
                    <RecordRow
                      key={row.label}
                      label={row.label}
                      value={row.value}
                      last={index === record.length - 1}
                    />
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── In stock ───────── */}
      <section id="in-stock" className="mx-auto max-w-[1320px] px-5 pt-[clamp(40px,6vw,76px)]">
        <div className="flex items-end justify-between gap-4 border-b border-foreground/15 pb-4">
          <div>
            <p className="label-mono flex items-center gap-3 text-primary">
              <span className="inline-block h-px w-[34px] bg-primary" />
              For sale now
            </p>
            <h2 className="mt-3 font-heading text-[clamp(30px,4.6vw,54px)]">
              {name} <span className="text-primary">in stock</span>
            </h2>
          </div>
          <p className="label-mono shrink-0 pb-1 text-foreground/60">{guitars(inStock.length)}</p>
        </div>

        {inStock.length > 0 ? (
          <div className="mt-7 grid grid-cols-1 gap-8 md:grid-cols-[repeat(auto-fill,minmax(268px,1fr))] md:gap-[clamp(20px,2.4vw,32px)]">
            {inStock.map((listing, index) => (
              <ListingCard key={listing.id} listing={toCardData(listing)} priority={index < 4} />
            ))}
          </div>
        ) : (
          <div className="receipt mt-7 max-w-[640px]">
            <div className="receipt-rule" />
            <div className="p-6">
              <p className="font-heading text-[26px]">Nothing from {name} today</p>
              <p className="mt-3 text-foreground/75">
                Tell me what you&apos;re after and I&apos;ll let you know when one lands.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/contact"
                  className="btn-mono min-h-12 border border-primary bg-primary px-5 py-3 text-primary-foreground hover:border-foreground hover:bg-foreground"
                >
                  Ask about {name}
                </Link>
                <Link
                  href="/#inventory"
                  className="btn-mono min-h-12 border border-foreground px-5 py-3 text-foreground hover:bg-foreground hover:text-background"
                >
                  See everything in stock
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ───────── What they sell for: a chart of the shop's own sales ───────── */}
      {bands && stats && (
        <section
          aria-labelledby="prices"
          className="mx-auto mt-[clamp(48px,7vw,92px)] grid max-w-[1320px] gap-10 px-5 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:items-end md:gap-[clamp(32px,5vw,72px)]"
        >
          <div>
            <p className="label-mono flex items-center gap-3 text-primary">
              <span className="inline-block h-px w-[34px] bg-primary" />
              From the sold ledger
            </p>
            <h2 id="prices" className="mt-3 font-heading text-[clamp(30px,4.6vw,54px)]">
              What {name} <span className="text-primary">sells for here</span>
            </h2>
            <p className="mt-4 max-w-[46ch] text-[17px] leading-[1.6] text-foreground/75">
              Real sale prices from this shop, not asking prices from somewhere else. Half of the{' '}
              {sold.length} {name} guitars sold here went for {formatPrice(stats.median)} or less.
              The lowest was {formatPrice(stats.low)} and the highest {formatPrice(stats.high)}.
            </p>
          </div>

          <figure className="m-0">
            <ol className="grid h-[220px] grid-cols-5 items-end gap-2.5 border-b border-foreground md:h-[260px] md:gap-4">
              {bands.map((band, index) => (
                <li key={band.label} className="flex h-full flex-col justify-end">
                  <span className="mb-1.5 text-center font-heading text-[22px] leading-none md:text-[28px]">
                    {band.count}
                  </span>
                  <span
                    className={cn(
                      'bar-grow block w-full',
                      band.count === tallest ? 'bg-primary' : 'bg-foreground/85',
                    )}
                    style={{
                      height: `${band.count === 0 ? 0 : Math.max(3, (band.count / tallest) * 78)}%`,
                      animationDelay: `${index * 80}ms`,
                    }}
                  />
                </li>
              ))}
            </ol>
            <ol className="mt-2.5 grid grid-cols-5 gap-2.5 md:gap-4">
              {bands.map((band) => (
                <li key={band.label} className="label-mono-sm text-center leading-[1.5] text-foreground/65">
                  {band.label}
                </li>
              ))}
            </ol>
            <figcaption className="sr-only">
              Number of {name} guitars sold by this shop in each price band.
            </figcaption>
          </figure>
        </section>
      )}

      {/* ───────── Recently sold ───────── */}
      {soldShown.length > 0 && (
        <section aria-labelledby="sold" className="mx-auto mt-[clamp(48px,7vw,92px)] max-w-[1320px] px-5">
          <div className="flex items-end justify-between gap-4 border-b border-foreground/15 pb-4">
            <div>
              <p className="label-mono flex items-center gap-3 text-primary">
                <span className="inline-block h-px w-[34px] bg-primary" />
                Gone, but on the record
              </p>
              <h2 id="sold" className="mt-3 font-heading text-[clamp(30px,4.6vw,54px)]">
                Recently sold
              </h2>
            </div>
            {sold.length > soldShown.length && (
              <Link
                href="/sold"
                className="label-mono shrink-0 border-b border-foreground/30 pb-1 text-foreground/70 transition-colors hover:border-primary hover:text-primary"
              >
                All sold →
              </Link>
            )}
          </div>

          <ul className="mt-7 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] md:gap-x-6">
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
                        className="object-cover grayscale-[0.65] transition duration-500 ease-out group-hover:scale-[1.05] group-hover:grayscale-0"
                      />
                    )}
                    <span className="label-mono absolute top-0 left-0 bg-foreground px-2 py-1 text-background transition-colors group-hover:bg-primary">
                      Sold
                    </span>
                  </div>
                  <p className="mt-2.5 line-clamp-2 text-sm leading-snug font-semibold transition-colors group-hover:text-primary">
                    {listing.listing_title}
                  </p>
                  <p className="mt-1.5 flex items-baseline gap-2">
                    <span className="font-heading text-lg leading-none">
                      {formatPrice(listing.price, listing.currency)}
                    </span>
                    {listing.condition && (
                      <span className="label-mono-sm text-foreground/55">{listing.condition}</span>
                    )}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ───────── Onward links: models of this maker, other makers ───────── */}
      {linkSections
        .filter((section) => section.links.length > 0)
        .map((section) => (
          <section
            key={section.title}
            aria-label={section.title}
            className="mx-auto mt-[clamp(48px,7vw,92px)] max-w-[1320px] px-5"
          >
            <h2 className="label-mono flex items-center gap-3 text-primary">
              <span className="inline-block h-px w-[34px] bg-primary" />
              {section.title}
            </h2>
            <ul className="mt-5 grid grid-cols-2 border-t border-l border-foreground/15 sm:grid-cols-3 lg:grid-cols-6">
              {section.links.map((link) => (
                <li key={link.href} className="border-r border-b border-foreground/15">
                  <Link
                    href={link.href}
                    className="group flex h-full min-h-[88px] flex-col justify-between gap-3 p-4 transition-colors hover:bg-foreground hover:text-background"
                  >
                    <span className="font-heading text-[22px] leading-none">{link.label}</span>
                    <span className="label-mono-sm text-foreground/55 transition-colors group-hover:text-background/70">
                      {link.note}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

      {/* ───────── Closing band ───────── */}
      <section className="mt-[clamp(56px,8vw,104px)] bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-x-10 gap-y-6 px-5 py-[clamp(36px,5vw,60px)]">
          <div>
            <h2 className="font-heading text-[clamp(28px,4.2vw,50px)]">
              Hunting a specific {name}?
            </h2>
            <p className="mt-3 max-w-[52ch] text-[17px] leading-[1.55] text-primary-foreground/80">
              Tell me the model and I&apos;ll keep an eye out. Got one to move on? I buy and take
              trades too.
            </p>
          </div>
          <div className="flex w-full flex-wrap gap-3 sm:w-auto">
            <Link
              href="/contact"
              className="btn-mono min-h-[52px] flex-1 border border-primary-foreground bg-primary-foreground px-6 py-4 text-primary hover:bg-transparent hover:text-primary-foreground sm:flex-none"
            >
              Get in touch
            </Link>
            <Link
              href="/trade-in"
              className="btn-mono min-h-[52px] flex-1 border border-primary-foreground/60 px-6 py-4 text-primary-foreground hover:border-primary-foreground hover:bg-primary-foreground hover:text-primary sm:flex-none"
            >
              Trade yours in
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
