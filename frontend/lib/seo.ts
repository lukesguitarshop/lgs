/**
 * Shared by the Google Merchant feed, the listing page's structured data, and its
 * meta tags. Google cross-checks all three, and a listing whose feed says one thing
 * while its page says another gets disapproved, so they read from one place.
 */

export const SITE_NAME = "Luke's Guitar Shop";

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://lukesguitarshop.com';
}

/** Google's taxonomy ID for "... > Musical Instruments > String Instruments > Guitars". */
export const GOOGLE_PRODUCT_CATEGORY_ID = 80;

const KNOWN_BRANDS = [
  'Paul Reed Smith', 'Fender', 'Gibson', 'Epiphone', 'Martin', 'Taylor', 'PRS',
  'Ibanez', 'Jackson', 'ESP', 'LTD', 'Schecter', 'Gretsch', 'Rickenbacker',
  'Yamaha', 'Squier', 'Guild', 'Ovation', 'Takamine', 'Washburn', 'Dean',
  'BC Rich', 'Charvel', 'EVH', 'Music Man', 'Ernie Ball', 'G&L', 'Suhr',
  'Collings', 'Santa Cruz', 'Bourgeois', 'Larrivee', 'Breedlove', 'Alvarez',
  'Seagull', 'Godin', 'Eastman', 'Heritage', 'Reverend', "D'Angelico",
  'Danelectro', 'Harmony', 'Kay', 'Silvertone', 'Teisco', 'Kramer', 'Peavey',
  'Sterling', 'Strandberg', 'Mayones', 'Tom Anderson', 'Knaggs', 'Duesenberg',
  'Hagstrom', 'Hofner', 'Framus', 'National', 'Dobro', 'Cort', 'Tokai',
  'Greco', 'Burny', 'FGN', 'Fujigen', 'Novo', 'Nash', 'Harmony',
];

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The maker named in the title, or null. Matches whole words only, so "Dean" is not
 * found inside "Deand" and "LTD" is not found inside a longer word. A title that
 * names two makers ("Squier by Fender") resolves to whichever comes first.
 */
export function extractBrand(title: string): string | null {
  let best: { brand: string; index: number } | null = null;
  for (const brand of KNOWN_BRANDS) {
    const match = new RegExp(`(^|[^a-z0-9])${escapeRegExp(brand)}(?![a-z0-9])`, 'i').exec(title);
    if (match && (best === null || match.index < best.index)) {
      best = { brand, index: match.index };
    }
  }
  return best?.brand ?? null;
}

/** Listing titles end " - <finish>" by convention; that finish is the colour. */
export function extractColor(title: string): string | null {
  const index = title.lastIndexOf(' - ');
  if (index === -1) return null;
  const color = title.slice(index + 3).trim();
  return color.length > 0 && color.length <= 40 ? color : null;
}

/**
 * HTML to plain text. Block boundaries become spaces first: stripping tags alone
 * welds the last word of one paragraph onto the first word of the next.
 */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The write-up about the guitar itself. Listings carry the shop's whole return
 * policy after a "Return Policy:" heading; that is the same on every listing and
 * tells a shopper (or Google) nothing about this instrument.
 */
export function productDescription(html: string | null | undefined): string {
  const text = htmlToText(html);
  const policyStart = text.search(/Return Policy\s*:/i);
  return (policyStart === -1 ? text : text.slice(0, policyStart)).trim();
}

/** Cuts at a word boundary and adds an ellipsis, rather than stopping mid-word. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-–—]+$/, '')}…`;
}

export type FeedCondition = 'new' | 'refurbished' | 'used';

/**
 * Google's condition for a listing. "Mint" and "Excellent" describe a used guitar's
 * shape; only a condition that literally says new ("Brand New", "New") is new.
 * Sending a used guitar as new is a policy violation.
 */
export function feedCondition(condition: string | null | undefined): FeedCondition {
  const lower = (condition ?? '').toLowerCase();
  if (lower.includes('refurbished')) return 'refurbished';
  if (/\bnew\b/.test(lower) && !/like new|as new|near new/.test(lower)) return 'new';
  return 'used';
}

export function schemaCondition(condition: string | null | undefined): string {
  switch (feedCondition(condition)) {
    case 'new':
      return 'https://schema.org/NewCondition';
    case 'refurbished':
      return 'https://schema.org/RefurbishedCondition';
    default:
      return 'https://schema.org/UsedCondition';
  }
}

interface Purchasable {
  disabled?: boolean;
  is_reserved?: boolean;
}

/** A reserved guitar is being held for someone, so nobody else can buy it. */
export function isPurchasable(listing: Purchasable): boolean {
  return !listing.disabled && !listing.is_reserved;
}

export function formatPrice(price: number, currency?: string | null): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(price) ? 0 : 2,
  }).format(price);
}

interface DescribableListing {
  listing_title: string;
  description: string | null;
  condition: string | null;
  price: number;
  currency?: string | null;
}

/**
 * The text under a listing's link in Google. Leads with what a shopper scans for
 * (condition, price, shipping) and spends the rest on the guitar's own write-up.
 */
export function listingMetaDescription(listing: DescribableListing): string {
  const lead = [
    listing.condition ? `${listing.condition} condition` : null,
    formatPrice(listing.price, listing.currency),
    'Free insured shipping',
  ]
    .filter(Boolean)
    .join(' · ');
  const body =
    productDescription(listing.description) ||
    `${listing.listing_title}, photographed in full and available now at ${SITE_NAME}.`;
  return truncate(`${lead}. ${body}`, 158);
}
