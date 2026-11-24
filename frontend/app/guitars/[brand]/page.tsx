import { notFound } from 'next/navigation';
import { Showcase, guitars } from '@/components/brand/Showcase';
import {
  getActiveListings,
  getSoldListings,
  isIndexableBrand,
  listingsForBrand,
  summarizeBrands,
} from '@/lib/catalog';
import { formatPrice } from '@/lib/format';
import { isIndexableModel, modelPath, summarizeModels } from '@/lib/models';
import { SITE_NAME, brandFromSlug, brandPath } from '@/lib/seo';

/**
 * One page per maker: every guitar of that brand for sale now, then what the shop
 * has already sold. It exists so a search like "used PRS guitars" has a page to land
 * on; the homepage lists everything and ranks for nothing that specific.
 *
 * Every figure on it is computed from the live catalogue. Nothing here is written
 * per brand, so a new maker gets a full page the day its first guitar is listed.
 */

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
  const models = summarizeModels(inStock, soldOfBrand).filter(isIndexableModel);
  return { brand, inStock, sold: soldOfBrand, otherBrands, models };
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

  const { brand, inStock, sold, otherBrands, models } = data;
  const stockNote = (summary: { inStock: number; sold: number }) =>
    summary.inStock > 0 ? `${summary.inStock} in stock` : `${summary.sold} sold`;

  return (
    <Showcase
      name={brand}
      headline={brand}
      kicker="Used"
      path={brandPath(brand)}
      trail={[{ label: 'Shop by brand', href: '/guitars' }]}
      inStock={inStock}
      sold={sold}
      linkSections={[
        {
          title: `${brand} by model`,
          links: models.map((summary) => ({
            label: summary.model,
            href: modelPath(brand, summary.model),
            note: stockNote(summary),
          })),
        },
        {
          title: 'Keep looking',
          links: otherBrands.map((summary) => ({
            label: summary.brand,
            href: brandPath(summary.brand),
            note: stockNote(summary),
          })),
        },
      ]}
    />
  );
}
