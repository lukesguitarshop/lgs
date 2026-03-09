import { NextResponse } from 'next/server';

interface Listing {
  id: string;
  listing_title: string;
  description: string | null;
  condition: string | null;
  images: string[];
  price: number;
  original_price?: number | null;
  currency: string;
  disabled?: boolean;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripHtml(html: string | null): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

function mapCondition(condition: string | null): string {
  if (!condition) return 'used';
  const lower = condition.toLowerCase();
  if (lower.includes('new') || lower.includes('mint')) return 'new';
  if (lower.includes('refurbished')) return 'refurbished';
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
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://guitar-price-api.fly.dev/api';

  try {
    const res = await fetch(`${apiBaseUrl}/listings`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return new NextResponse('Failed to fetch listings', { status: 500 });
    }

    const listings: Listing[] = await res.json();
    const activeListings = listings.filter((l) => !l.disabled);

    const items = activeListings.map((listing) => {
      const description = stripHtml(listing.description) || listing.listing_title;
      const brand = extractBrand(listing.listing_title);
      const condition = mapCondition(listing.condition);
      const additionalImages = listing.images.slice(1, 10).map((img) => 
        `      <g:additional_image_link>${escapeXml(img)}</g:additional_image_link>`
      ).join('\n');

      return `    <item>
      <g:id>${escapeXml(listing.id)}</g:id>
      <g:title>${escapeXml(listing.listing_title)}</g:title>
      <g:description>${escapeXml(description.slice(0, 5000))}</g:description>
      <g:link>${siteUrl}/listing/${listing.id}</g:link>
      <g:image_link>${listing.images[0] ? escapeXml(listing.images[0]) : ''}</g:image_link>
${additionalImages}
      <g:availability>in_stock</g:availability>
      <g:price>${listing.price.toFixed(2)} ${listing.currency || 'USD'}</g:price>
      <g:brand>${escapeXml(brand)}</g:brand>
      <g:condition>${condition}</g:condition>
      <g:google_product_category>Musical Instruments &gt; String Instruments &gt; Guitars</g:google_product_category>
      <g:product_type>Musical Instruments &gt; Guitars</g:product_type>
      <g:shipping>
        <g:country>US</g:country>
        <g:service>Free Shipping</g:service>
        <g:price>0 USD</g:price>
      </g:shipping>
    </item>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Luke's Guitar Shop</title>
    <link>${siteUrl}</link>
    <description>Quality new and used guitars at great prices. Free shipping on all orders.</description>
${items}
  </channel>
</rss>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('Error generating feed:', error);
    return new NextResponse('Error generating feed', { status: 500 });
  }
}
