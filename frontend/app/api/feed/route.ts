import { NextResponse } from 'next/server';

interface Listing {
  id: string;
  listing_title: string;
  description: string | null;
  condition: string | null;
  images: string[];
  price: number;
  currency: string;
  scraped_at: string;
  disabled?: boolean;
}

async function getListings(): Promise<Listing[]> {
  // Use production API URL directly for server-side fetch
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    'https://guitar-price-api.fly.dev/api';

  try {
    const res = await fetch(`${apiBaseUrl}/listings`, {
      next: { revalidate: 3600 },
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      console.error('Feed: Failed to fetch listings:', res.status, res.statusText);
      return [];
    }

    return await res.json();
  } catch (error) {
    console.error('Feed: Error fetching listings:', error);
    return [];
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")  // Smart single quotes
    .replace(/[\u201C\u201D]/g, '"')  // Smart double quotes
    .replace(/[\u2013\u2014]/g, '-')  // En/em dashes
    .replace(/\u00A0/g, ' ')          // Non-breaking space
    .replace(/[^\x20-\x7E\n\r]/g, '') // Remove other non-ASCII
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripHtml(html: string | null): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/[\u2018\u2019]/g, "'")  // Smart single quotes
    .replace(/[\u201C\u201D]/g, '"')  // Smart double quotes
    .replace(/[\u2013\u2014]/g, '-')  // En/em dashes
    .replace(/\u00A0/g, ' ')          // Non-breaking space
    .replace(/[^\x20-\x7E\n\r]/g, '') // Remove other non-ASCII
    .trim();
}

function mapConditionToGoogle(condition: string | null): string {
  if (!condition) return 'used';
  const conditionLower = condition.toLowerCase();
  if (conditionLower.includes('new') || conditionLower.includes('mint')) {
    return 'new';
  }
  if (conditionLower.includes('refurbished')) {
    return 'refurbished';
  }
  return 'used';
}

function extractBrand(title: string): string {
  const knownBrands = [
    'Fender', 'Gibson', 'Epiphone', 'Martin', 'Taylor', 'PRS', 'Paul Reed Smith',
    'Ibanez', 'Jackson', 'ESP', 'LTD', 'Schecter', 'Gretsch', 'Rickenbacker',
    'Yamaha', 'Squier', 'Guild', 'Ovation', 'Takamine', 'Washburn', 'Dean',
    'BC Rich', 'Charvel', 'EVH', 'Music Man', 'Ernie Ball', 'G&L', 'Suhr',
    'Collings', 'Santa Cruz', 'Bourgeois', 'Larrivee', 'Breedlove', 'Alvarez',
    'Seagull', 'Godin', 'Eastman', 'Heritage', 'Reverend', "D'Angelico",
  ];

  for (const brand of knownBrands) {
    if (title.toLowerCase().includes(brand.toLowerCase())) {
      return brand;
    }
  }
  return "Luke's Guitar Shop";
}

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lukesguitarshop.com';
  const listings = await getListings();

  // Filter to only active listings
  const activeListings = listings.filter((listing) => !listing.disabled);

  const items = activeListings.map((listing) => {
    const description = stripHtml(listing.description) ||
      `${listing.listing_title} - Quality guitar available at Luke's Guitar Shop`;
    const truncatedDescription = description.slice(0, 5000);

    return `
    <item>
      <g:id>${escapeXml(listing.id)}</g:id>
      <g:title>${escapeXml(listing.listing_title.slice(0, 150))}</g:title>
      <g:description>${escapeXml(truncatedDescription)}</g:description>
      <g:link>${siteUrl}/listing/${listing.id}</g:link>
      <g:image_link>${listing.images[0] ? escapeXml(listing.images[0]) : ''}</g:image_link>
      ${listing.images.slice(1, 10).map((img) => `<g:additional_image_link>${escapeXml(img)}</g:additional_image_link>`).join('\n      ')}
      <g:availability>in_stock</g:availability>
      <g:price>${listing.price.toFixed(2)} ${listing.currency || 'USD'}</g:price>
      <g:brand>${escapeXml(extractBrand(listing.listing_title))}</g:brand>
      <g:condition>${mapConditionToGoogle(listing.condition)}</g:condition>
      <g:identifier_exists>false</g:identifier_exists>
      <g:google_product_category>499732</g:google_product_category>
      <g:product_type>Musical Instruments &gt; String Instruments &gt; Guitars</g:product_type>
      <g:shipping>
        <g:country>US</g:country>
        <g:service>Standard</g:service>
        <g:price>0.00 USD</g:price>
      </g:shipping>
      <g:shipping>
        <g:country>CA</g:country>
        <g:service>Standard</g:service>
        <g:price>0.00 CAD</g:price>
      </g:shipping>
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Luke's Guitar Shop</title>
    <link>${siteUrl}</link>
    <description>Quality guitars at great prices - Luke's Guitar Shop</description>
    ${items.join('\n')}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
