import Image from 'next/image';
import Link from 'next/link';
import {
  getActiveListings,
  getSoldListings,
  groupByBrand,
  isIndexableBrand,
  summarizeBrands,
} from '@/lib/catalog';
import { Print } from '@/components/brand/Print';
import { formatPrice } from '@/lib/format';
import { brandPath } from '@/lib/seo';

export const metadata = {
  title: 'Shop Used Guitars by Brand',
  description:
    "Browse Luke's Guitar Shop by maker: used Gibson, Fender, PRS, ESP, Ibanez and more. See what's in stock and what each brand has sold for.",
  alternates: { canonical: '/guitars' },
  openGraph: { url: '/guitars' },
};

/**
 * The brand index. Makers with a guitar for sale lead as photo tiles; underneath,
 * every maker the shop has carried is ranked by how many it has sold. All counts and
 * photos come from the live catalogue.
 */
export default async function BrandsPage() {
  const [active, sold] = await Promise.all([getActiveListings(), getSoldListings()]);
  const brands = summarizeBrands(active, sold).filter(isIndexableBrand);
  const activeByBrand = groupByBrand(active);
  const soldByBrand = groupByBrand(sold);

  const stocked = brands
    .filter((summary) => summary.inStock > 0)
    .map((summary) => {
      const listings = activeByBrand.get(summary.brand) ?? [];
      return {
        ...summary,
        cover: listings.find((listing) => listing.images?.[0])?.images[0] ?? null,
        from: Math.min(...listings.map((listing) => listing.price)),
      };
    });

  // The ledger is ranked by sales, which is a different order from the tiles above.
  const ledger = [...brands]
    .sort((a, b) => b.sold - a.sold || b.inStock - a.inStock)
    .map((summary) => ({
      ...summary,
      thumb:
        (activeByBrand.get(summary.brand) ?? soldByBrand.get(summary.brand) ?? []).find(
          (listing) => listing.images?.[0],
        )?.images[0] ??
        soldByBrand.get(summary.brand)?.find((listing) => listing.images?.[0])?.images[0] ??
        null,
    }));
  const mostSold = Math.max(1, ...ledger.map((summary) => summary.sold));
  // Every guitar sold, including makers too small to have a page of their own.
  const totalSold = sold.length;
  // One print per stocked maker, so the hero shows the range rather than three of a kind.
  const prints = stocked.filter((summary) => summary.cover).slice(0, 3);
  const totalInStock = stocked.reduce((sum, summary) => sum + summary.inStock, 0);

  if (brands.length === 0) {
    return (
      <div className="mx-auto max-w-[1320px] px-5 pt-10 pb-16">
        <h1 className="font-heading text-3xl text-primary sm:text-5xl">Shop by brand</h1>
        <p className="mt-6 text-foreground/75">
          The brand list is unavailable right now.{' '}
          <Link href="/#inventory" className="underline hover:text-primary">
            See everything in stock
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <>
      {/* ───────── Hero ───────── */}
      <section className="relative overflow-hidden bg-foreground text-background">
        <span
          aria-hidden
          className="ghost-word pointer-events-none absolute -right-[1vw] -bottom-[0.2em] font-heading text-[30vw] leading-none whitespace-nowrap select-none md:text-[19vw]"
        >
          Makers
        </span>

        <div className="relative mx-auto grid max-w-[1320px] gap-10 px-5 pt-9 pb-11 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:items-center md:gap-[clamp(32px,5vw,72px)] md:pt-[clamp(48px,6vw,84px)] md:pb-[clamp(52px,6.5vw,92px)]">
          <div className="min-w-0">
          <p className="label-mono flex items-center gap-3 text-muted-foreground">
            <span className="inline-block h-px w-[34px] bg-muted-foreground" />
            The catalogue, by maker
          </p>
          <h1 className="rise mt-4 font-heading text-[clamp(52px,10.5vw,148px)] leading-[0.88]">
            Shop by
            <br />
            <span className="text-muted-foreground">brand.</span>
          </h1>
          <p
            className="rise mt-6 max-w-[52ch] text-[clamp(16px,1.5vw,19px)] leading-[1.55] text-background/75"
            style={{ animationDelay: '90ms' }}
          >
            Every maker that has come through the shop. Pick one to see what&apos;s for sale today
            and what its guitars have actually sold for here.
          </p>

          <dl
            className="rise mt-9 grid max-w-[560px] grid-cols-3 border-t border-background/22"
            style={{ animationDelay: '170ms' }}
          >
            {[
              { label: 'Makers', value: brands.length },
              { label: 'In stock', value: totalInStock },
              { label: 'Guitars sold', value: totalSold },
            ].map((stat, index) => (
              <div
                key={stat.label}
                className={`pt-4 ${index > 0 ? 'border-l border-dashed border-background/25 pl-4 md:pl-6' : ''}`}
              >
                <dd className="m-0 font-heading text-[clamp(34px,5vw,60px)] leading-none">
                  {stat.value}
                </dd>
                <dt className="label-mono-sm mt-2 text-background/55">{stat.label}</dt>
              </div>
            ))}
          </dl>
          </div>

          {prints.length > 0 && (
            <div
              className="rise relative mx-auto hidden aspect-[1/1] w-full max-w-[520px] md:block"
              style={{ animationDelay: '120ms' }}
            >
              {prints[2] && (
                <Print
                  src={prints[2].cover!}
                  alt={`Used ${prints[2].brand} guitar in stock`}
                  className="right-0 bottom-[3%] z-0 aspect-square w-[44%] rotate-[5deg]"
                />
              )}
              {prints[1] && (
                <Print
                  src={prints[1].cover!}
                  alt={`Used ${prints[1].brand} guitar in stock`}
                  className="top-0 right-[4%] z-10 aspect-[4/5] w-[46%] rotate-[3deg]"
                />
              )}
              <Print
                src={prints[0].cover!}
                alt={`Used ${prints[0].brand} guitar in stock`}
                className="top-[14%] left-0 z-20 aspect-[4/5] w-[54%] -rotate-[3deg]"
                priority
              />
            </div>
          )}
        </div>
      </section>

      {/* ───────── Makers with something for sale ───────── */}
      {stocked.length > 0 && (
        <section aria-labelledby="stocked" className="mx-auto max-w-[1320px] px-5 pt-[clamp(40px,6vw,76px)]">
          <p className="label-mono flex items-center gap-3 text-primary">
            <span className="inline-block h-px w-[34px] bg-primary" />
            For sale now
          </p>
          <h2 id="stocked" className="mt-3 font-heading text-[clamp(30px,4.6vw,54px)]">
            On the wall <span className="text-primary">today</span>
          </h2>

          <ul className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7">
            {stocked.map((summary, index) => (
              <li key={summary.brand} className="rise" style={{ animationDelay: `${index * 70}ms` }}>
                <Link
                  href={brandPath(summary.brand)}
                  className="group relative block overflow-hidden border border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="photo-panel relative aspect-[4/3] overflow-hidden sm:aspect-[4/5]">
                    {summary.cover && (
                      <Image
                        src={summary.cover}
                        alt={`Used ${summary.brand} guitar in stock`}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 420px"
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
                        priority={index < 3}
                      />
                    )}
                    <span className="label-mono absolute top-0 left-0 bg-primary px-2.5 py-1.5 text-primary-foreground">
                      {summary.inStock} in stock
                    </span>
                  </div>

                  <div className="flex items-end justify-between gap-4 bg-foreground px-5 py-4 text-background transition-colors duration-300 group-hover:bg-primary">
                    <div className="min-w-0">
                      <p className="font-heading text-[clamp(34px,4.4vw,52px)] leading-[0.9]">
                        {summary.brand}
                      </p>
                      <p className="label-mono-sm mt-2 text-background/65">
                        From {formatPrice(summary.from)} · {summary.sold} sold
                      </p>
                    </div>
                    <span
                      aria-hidden
                      className="shrink-0 pb-1 font-heading text-[30px] leading-none transition-transform duration-300 group-hover:translate-x-1.5"
                    >
                      →
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ───────── The ledger: every maker, ranked by guitars sold ───────── */}
      <section
        aria-labelledby="ledger"
        className="mx-auto max-w-[1320px] px-5 pt-[clamp(48px,7vw,92px)] pb-[clamp(56px,8vw,104px)]"
      >
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="label-mono flex items-center gap-3 text-primary">
              <span className="inline-block h-px w-[34px] bg-primary" />
              The sold ledger
            </p>
            <h2 id="ledger" className="mt-3 font-heading text-[clamp(30px,4.6vw,54px)]">
              Every maker, <span className="text-primary">by the numbers</span>
            </h2>
          </div>
          <p className="label-mono hidden shrink-0 pb-1 text-foreground/60 sm:block">
            {ledger.length} makers
          </p>
        </div>

        <ol className="mt-7 border-t border-foreground">
          {ledger.map((summary, index) => (
            <li key={summary.brand} className="border-b border-foreground/15">
              <Link
                href={brandPath(summary.brand)}
                className="group grid grid-cols-[auto_52px_minmax(0,1fr)_auto] items-center gap-x-4 py-3.5 transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring md:grid-cols-[auto_64px_minmax(140px,0.6fr)_minmax(0,1fr)_auto_auto] md:gap-x-6 md:px-3"
              >
                <span className="label-mono w-6 text-foreground/45">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <span className="photo-panel relative block aspect-square w-[52px] overflow-hidden border border-foreground/15 md:w-16">
                  {summary.thumb && (
                    <Image
                      src={summary.thumb}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  )}
                </span>

                <span className="min-w-0">
                  <span className="block truncate font-heading text-[26px] leading-none transition-colors group-hover:text-primary md:text-[34px]">
                    {summary.brand}
                  </span>
                  <span className="label-mono-sm mt-1.5 block text-foreground/55 md:hidden">
                    {summary.sold} sold
                    {summary.inStock > 0 && (
                      <span className="text-primary"> · {summary.inStock} in stock</span>
                    )}
                  </span>
                </span>

                {/* Bar length is this maker's sales against the best-selling maker's. */}
                <span className="hidden h-2.5 bg-foreground/[0.07] md:block" aria-hidden>
                  <span
                    className="bar-grow-x block h-full bg-primary"
                    style={{
                      width: `${Math.max(1.5, (summary.sold / mostSold) * 100)}%`,
                      animationDelay: `${index * 45}ms`,
                    }}
                  />
                </span>

                <span className="hidden w-[150px] text-right md:block">
                  <span className="font-heading text-[26px] leading-none">{summary.sold}</span>
                  <span className="label-mono-sm ml-2 text-foreground/55">sold</span>
                  {summary.inStock > 0 && (
                    <span className="label-mono-sm mt-1 block text-primary">
                      {summary.inStock} in stock
                    </span>
                  )}
                </span>

                <span
                  aria-hidden
                  className="font-heading text-[22px] leading-none text-foreground/35 transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary"
                >
                  →
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
