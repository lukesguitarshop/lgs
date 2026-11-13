import Link from 'next/link';
import {
  getActiveListings,
  getSoldListings,
  isIndexableBrand,
  summarizeBrands,
} from '@/lib/catalog';
import { brandPath } from '@/lib/seo';

export const metadata = {
  title: 'Used Guitars by Brand',
  description:
    "Browse Luke's Guitar Shop by maker: used Gibson, Fender, PRS, ESP, Ibanez and more. See what's in stock and what each brand has sold for.",
  alternates: { canonical: '/guitars' },
  openGraph: { url: '/guitars' },
};

/** The brand index: one row per maker the shop has stocked, with live counts. */
export default async function BrandsPage() {
  const [active, sold] = await Promise.all([getActiveListings(), getSoldListings()]);
  const brands = summarizeBrands(active, sold).filter(isIndexableBrand);

  return (
    <div className="mx-auto max-w-[1320px] px-5 pt-8 pb-12 md:pt-12">
      <h1 className="font-heading text-3xl text-primary sm:text-5xl">Guitars by brand</h1>
      <p className="mt-4 max-w-[68ch] text-[17px] leading-[1.6] text-foreground/80">
        Every maker the shop has carried. Pick one to see what&apos;s for sale now and what has
        already sold.
      </p>

      {brands.length > 0 ? (
        <ul className="mt-8 grid grid-cols-1 border-t border-foreground/15 sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-3">
          {brands.map((summary) => (
            <li key={summary.brand} className="border-b border-foreground/12">
              <Link
                href={brandPath(summary.brand)}
                className="group flex min-h-[56px] items-baseline justify-between gap-4 py-3.5"
              >
                <span className="text-[17px] font-semibold group-hover:text-primary">
                  {summary.brand}
                </span>
                <span className="label-mono-sm text-foreground/60">
                  {summary.inStock > 0 ? `${summary.inStock} in stock · ` : ''}
                  {summary.sold} sold
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-foreground/75">
          The brand list is unavailable right now.{' '}
          <Link href="/#inventory" className="underline hover:text-primary">
            See everything in stock
          </Link>
          .
        </p>
      )}
    </div>
  );
}
