import { notFound } from 'next/navigation';
import { Showcase, guitars } from '@/components/brand/Showcase';
import { getActiveListings, getSoldListings, listingsForBrand } from '@/lib/catalog';
import { formatPrice } from '@/lib/format';
import {
  isIndexableModel,
  listingsForModel,
  modelFromSlug,
  modelPath,
  summarizeModels,
} from '@/lib/models';
import { SITE_NAME, brandFromSlug, brandPath } from '@/lib/seo';

/**
 * One page per model family, under its maker: "/guitars/gibson/les-paul". Buyers
 * search by model far more than by maker, and until this existed the closest page
 * the shop could offer for "used Gibson Les Paul" was every Gibson it had.
 *
 * Which families exist is decided by lib/models.ts; the page itself is the same
 * Showcase the maker pages use, fed only that family's guitars.
 */

interface PageProps {
  params: Promise<{ brand: string; model: string }>;
}

async function loadModel(brandSlug: string, modelSlug: string) {
  const brand = brandFromSlug(brandSlug);
  if (!brand) return null;
  const model = modelFromSlug(brand, modelSlug);
  if (!model) return null;

  const [active, sold] = await Promise.all([getActiveListings(), getSoldListings()]);
  const inStock = listingsForModel(active, brand, model);
  const soldOfModel = listingsForModel(sold, brand, model);
  if (inStock.length === 0 && soldOfModel.length === 0) return null;

  const siblings = summarizeModels(
    listingsForBrand(active, brand),
    listingsForBrand(sold, brand),
  ).filter((summary) => summary.model !== model && isIndexableModel(summary));
  return { brand, model, inStock, sold: soldOfModel, siblings };
}

export async function generateMetadata({ params }: PageProps) {
  const { brand: brandSlug, model: modelSlug } = await params;
  const data = await loadModel(brandSlug, modelSlug);
  if (!data) return { title: 'Model not found' };

  const { brand, model, inStock, sold } = data;
  const name = `${brand} ${model}`;
  const stockLine =
    inStock.length > 0
      ? `${guitars(inStock.length)} in stock from ${formatPrice(Math.min(...inStock.map((l) => l.price)))}`
      : 'None in stock right now';
  const soldLine = sold.length > 0 ? ` ${sold.length} sold so far, with real sale prices.` : '';
  const description = `Used ${name} guitars at ${SITE_NAME}. ${stockLine}.${soldLine} 14+ photos of the exact guitar, every flaw disclosed, free insured shipping.`;
  const cover = inStock[0]?.images[0] ?? sold[0]?.images[0];
  const path = modelPath(brand, model);

  return {
    title: `Used ${name} Guitars for Sale`,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `Used ${name} Guitars for Sale | ${SITE_NAME}`,
      description,
      url: path,
      ...(cover && { images: [{ url: cover, alt: `Used ${name} guitars` }] }),
    },
    robots: {
      index: isIndexableModel({ brand, model, inStock: inStock.length, sold: sold.length }),
      follow: true,
    },
  };
}

export default async function ModelPage({ params }: PageProps) {
  const { brand: brandSlug, model: modelSlug } = await params;
  const data = await loadModel(brandSlug, modelSlug);
  if (!data) notFound();

  const { brand, model, inStock, sold, siblings } = data;

  return (
    <Showcase
      name={`${brand} ${model}`}
      headline={model}
      kicker={`Used ${brand}`}
      path={modelPath(brand, model)}
      trail={[
        { label: 'Shop by brand', href: '/guitars' },
        { label: brand, href: brandPath(brand) },
      ]}
      inStock={inStock}
      sold={sold}
      linkSections={[
        {
          title: `More from ${brand}`,
          links: [
            { label: `All ${brand}`, href: brandPath(brand), note: 'Every model' },
            ...siblings.map((summary) => ({
              label: summary.model,
              href: modelPath(brand, summary.model),
              note: summary.inStock > 0 ? `${summary.inStock} in stock` : `${summary.sold} sold`,
            })),
          ],
        },
      ]}
    />
  );
}
