import { NextResponse } from 'next/server';
import {
  GOOGLE_PRODUCT_CATEGORY_ID,
  SITE_NAME,
  extractBrand,
  extractColor,
  feedCondition,
  getSiteUrl,
  isPurchasable,
  listingPath,
  productDescription,
} from '@/lib/seo';

/**
 * The Google Merchant Center product feed (also served at /feed.xml and /products.xml).
 *
 * Every listing that is for sale goes in, and nothing is silently skipped: a listing
 * Google would reject (no photo, no price) is still left out, but it is named in the
 * X-Feed-Skipped header so a missing guitar can be traced.
 */

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
  is_reserved?: boolean;
}

// Sold guitars have to leave the feed quickly: Google disapproves items whose feed
// says "in stock" while the page says otherwise. Five minutes keeps the two close.
const FEED_TTL_SECONDS = 300;

function escapeXml(text: string): string {
  return text
    // Characters XML 1.0 forbids outright; one of these makes Google reject the whole file.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function money(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

function tag(name: string, value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  return `      <g:${name}>${escapeXml(String(value))}</g:${name}>`;
}

function buildItem(listing: Listing, siteUrl: string): string {
  const currency = listing.currency || 'USD';
  const brand = extractBrand(listing.listing_title);
  const description = productDescription(listing.description) || listing.listing_title;
  const onSale =
    typeof listing.original_price === 'number' && listing.original_price > listing.price;

  const lines = [
    tag('id', listing.id),
    tag('title', listing.listing_title.replace(/\*/g, '').replace(/\s+/g, ' ').trim().slice(0, 150)),
    tag('description', description.slice(0, 5000)),
    tag('link', `${siteUrl}${listingPath(listing.id, listing.listing_title)}`),
    tag('image_link', listing.images[0]),
    ...listing.images.slice(1, 11).map((img) => tag('additional_image_link', img)),
    tag('availability', isPurchasable(listing) ? 'in_stock' : 'out_of_stock'),
    // With a price drop, Google wants the old price as `price` and the new one as `sale_price`.
    tag('price', money(onSale ? (listing.original_price as number) : listing.price, currency)),
    onSale ? tag('sale_price', money(listing.price, currency)) : null,
    tag('condition', feedCondition(listing.condition)),
    tag('brand', brand),
    // Used guitars have no barcode. Saying so is what stops Google flagging every item
    // for a missing GTIN; without a recognised brand there is no identifier at all.
    tag('identifier_exists', 'no'),
    tag('color', extractColor(listing.listing_title)),
    tag('google_product_category', GOOGLE_PRODUCT_CATEGORY_ID),
    tag('product_type', brand ? `Guitars > ${brand}` : 'Guitars'),
    tag('custom_label_0', listing.condition),
    `      <g:shipping>
        <g:country>US</g:country>
        <g:service>Free insured shipping</g:service>
        <g:price>0.00 USD</g:price>
      </g:shipping>`,
  ].filter((line): line is string => line !== null);

  return `    <item>\n${lines.join('\n')}\n    </item>`;
}

export async function GET() {
  const siteUrl = getSiteUrl();
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://guitar-price-api.fly.dev/api';

  try {
    const res = await fetch(`${apiBaseUrl}/listings`, {
      next: { revalidate: FEED_TTL_SECONDS },
    });

    if (!res.ok) {
      // A 5xx tells Google to keep the products it already has and try again later.
      // An empty 200 would tell it the shop has nothing for sale.
      return new NextResponse('Failed to fetch listings', { status: 503 });
    }

    const listings: Listing[] = await res.json();
    const forSale = listings.filter((l) => !l.disabled);

    const skipped: string[] = [];
    const items: string[] = [];
    for (const listing of forSale) {
      const reason = !listing.images?.[0]
        ? 'no-image'
        : !(listing.price > 0)
          ? 'no-price'
          : !listing.listing_title?.trim()
            ? 'no-title'
            : null;
      if (reason) {
        skipped.push(`${listing.id}:${reason}`);
        console.warn(`Feed: skipping listing ${listing.id} (${reason})`);
        continue;
      }
      items.push(buildItem(listing, siteUrl));
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${siteUrl}</link>
    <description>Used and vintage guitars, photographed in full, with free insured shipping.</description>
${items.join('\n')}
  </channel>
</rss>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': `public, max-age=${FEED_TTL_SECONDS}, s-maxage=${FEED_TTL_SECONDS}`,
        'X-Feed-Items': String(items.length),
        ...(skipped.length > 0 && { 'X-Feed-Skipped': skipped.join(',') }),
      },
    });
  } catch (error) {
    console.error('Error generating feed:', error);
    return new NextResponse('Error generating feed', { status: 503 });
  }
}
