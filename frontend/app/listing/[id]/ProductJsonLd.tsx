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
 * Delivery and return terms, as schema.org wants them. These must say what Merchant
 * Center says (Shipping and returns) and what /return-policy says; change all three
 * together. Handling 0-1 days and transit 2 days, Mon-Sat; returns requested within
 * 1 day of delivery, by mail, buyer pays shipping, 15% restocking fee.
 */
const DELIVERY_TIME = {
  '@type': 'ShippingDeliveryTime',
  handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
  transitTime: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 2, unitCode: 'DAY' },
};

function returnPolicy(siteUrl: string) {
  return {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'US',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: 1,
    returnMethod: 'https://schema.org/ReturnByMail',
    returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
    // A bare number is read as a percentage of the price.
    restockingFee: 15,
    merchantReturnLink: `${siteUrl}/return-policy`,
  };
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
      // Sold is final; a hold is not, so a reserved guitar is only out of stock.
      availability: listing.disabled
        ? 'https://schema.org/SoldOut'
        : isPurchasable(listing)
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
        deliveryTime: DELIVERY_TIME,
      },
      hasMerchantReturnPolicy: returnPolicy(siteUrl),
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
