interface Listing {
  id: string;
  listing_title: string;
  description: string | null;
  condition: string | null;
  images: string[];
  price: number;
  currency: string;
  disabled?: boolean;
}

function mapConditionToSchema(condition: string | null): string {
  if (!condition) return 'https://schema.org/UsedCondition';

  const conditionLower = condition.toLowerCase();
  if (conditionLower.includes('new') || conditionLower.includes('mint')) {
    return 'https://schema.org/NewCondition';
  }
  if (conditionLower.includes('refurbished')) {
    return 'https://schema.org/RefurbishedCondition';
  }
  return 'https://schema.org/UsedCondition';
}

function extractBrand(title: string): string | null {
  const knownBrands = [
    'Fender', 'Gibson', 'Epiphone', 'Martin', 'Taylor', 'PRS', 'Paul Reed Smith',
    'Ibanez', 'Jackson', 'ESP', 'LTD', 'Schecter', 'Gretsch', 'Rickenbacker',
    'Yamaha', 'Squier', 'Guild', 'Ovation', 'Takamine', 'Washburn', 'Dean',
    'BC Rich', 'Charvel', 'EVH', 'Music Man', 'Ernie Ball', 'G&L', 'Suhr',
    'Collings', 'Santa Cruz', 'Bourgeois', 'Larrivee', 'Breedlove', 'Alvarez',
    'Seagull', 'Godin', 'Eastman', 'Heritage', 'Reverend', 'D\'Angelico',
  ];

  for (const brand of knownBrands) {
    if (title.toLowerCase().includes(brand.toLowerCase())) {
      return brand;
    }
  }
  return null;
}

function stripHtml(html: string | null): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

export function ProductJsonLd({ listing }: { listing: Listing }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lukesguitarshop.com';
  const brand = extractBrand(listing.listing_title);
  const plainDescription = stripHtml(listing.description);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.listing_title,
    description: plainDescription || `${listing.listing_title} available at Luke's Guitar Shop`,
    image: listing.images.length > 0 ? listing.images : undefined,
    url: `${siteUrl}/listing/${listing.id}`,
    sku: listing.id,
    category: 'Musical Instruments > String Instruments > Guitars',
    offers: {
      '@type': 'Offer',
      price: listing.price,
      priceCurrency: listing.currency || 'USD',
      availability: listing.disabled
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
      itemCondition: mapConditionToSchema(listing.condition),
      seller: {
        '@type': 'Organization',
        name: "Luke's Guitar Shop",
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
    ...(brand && {
      brand: {
        '@type': 'Brand',
        name: brand,
      },
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
