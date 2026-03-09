interface Listing {
  id: string;
  listing_title: string;
  original_price?: number | null;
}

export function BreadcrumbJsonLd({ listing }: { listing: Listing }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lukesguitarshop.com';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: siteUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Guitars',
        item: `${siteUrl}/?category=guitars`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: listing.listing_title,
        item: `${siteUrl}/listing/${listing.id}`,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
