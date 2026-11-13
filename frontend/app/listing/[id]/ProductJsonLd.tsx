import {
  SITE_NAME,
  extractBrand,
  extractColor,
  getSiteUrl,
  isPurchasable,
  listingPath,
  productDescription,
  schemaCondition,
} from '@/lib/seo';

interface Listing {
  id: string;
  listing_title: string;
  description: string | null;
  condition: string | null;
  images: string[];
  price: number;
  original_price: number | null;
  currency: string;
  disabled?: boolean;
  is_reserved?: boolean;
}

/**
 * Product structured data. Google reads this to keep price and availability current
 * between feed fetches, so it is built from the same helpers as /api/feed: the two
 * disagreeing is what gets a listing disapproved.
 */
export function ProductJsonLd({ listing }: { listing: Listing }) {
  const siteUrl = getSiteUrl();
  const brand = extractBrand(listing.listing_title);
  const color = extractColor(listing.listing_title);
  const url = `${siteUrl}${listingPath(listing.id, listing.listing_title)}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.listing_title,
    description:
      productDescription(listing.description) ||
      `${listing.listing_title} available at ${SITE_NAME}`,
    image: listing.images.length > 0 ? listing.images : undefined,
    url,
    sku: listing.id,
    category: 'Musical Instruments > String Instruments > Guitars',
    itemCondition: schemaCondition(listing.condition),
    ...(color && { color }),
    ...(brand && {
      brand: {
        '@type': 'Brand',
        name: brand,
      },
    }),
    offers: {
      '@type': 'Offer',
      url,
      price: listing.price,
      priceCurrency: listing.currency || 'USD',
      availability: isPurchasable(listing)
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: schemaCondition(listing.condition),
      seller: {
        '@type': 'Organization',
        name: SITE_NAME,
        url: siteUrl,
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: {
          '@type': 'MonetaryAmount',
          value: 0,
          currency: 'USD',
        },
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'US',
        },
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      // "<" is escaped so a description can never close the script tag early.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\u003c') }}
    />
  );
}
