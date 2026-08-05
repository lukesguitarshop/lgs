import { getFullQualityUrl, htmlToPlainText } from '../html-text';
import { BRANDS, SUBCATEGORIES } from './vocabulary';

/** Bulk-upload template caps the title column at 150 characters. */
const MAX_TITLE_LENGTH = 150;

/** The template exposes product_image_1 .. product_image_25. */
export const MAX_IMAGES = 25;

/**
 * Gear Exchange withholds a 5% seller fee plus a 2.5% transaction fee when a
 * seller cashes out via PayPal/Venmo/bank transfer. Both are waived when
 * earnings are redeemed as Sweetwater store credit.
 * https://www.sweetwater.com/used/help/selling/what-are-the-gear-exchange-fees-for-a-seller
 */
export const SWEETWATER_FEES = {
  sellerFeePercent: 5,
  transactionFeePercent: 2.5,
} as const;

export type PayoutMethod = 'cash' | 'store_credit';

export const RETURN_POLICY = `Return Policy:

Payment

Item is not reserved or considered sold until payment has fully cleared. Pending or unverified payments do not hold the item.

Pre-purchase Inspection

All buyers are responsible for reviewing every photo and the full listing description before purchasing. Additional photos, measurements, or details are available on request - please ask before you buy, not after. Purchasing constitutes acknowledgment that you have reviewed the listing in full.

All Sales Final

Items are sold as-is. Cancellations are not accepted once payment has cleared. A 15% restocking fee applies to any cancelled order, regardless of shipping or tracking status, as preparation, packing, and handling begin immediately upon sale.

Returns

Returns are by approval only and must be requested within 24 hours of delivery. Approved returns are subject to:

- A 15% restocking fee (non-negotiable)
- Return in original condition with all original packaging and accessories
- Buyer-paid return shipping with full insurance and signature confirmation
- Refund issued only after the item is received and inspected

Items returned damaged, incomplete, or without insurance are not eligible for refund.

Condition Expectations

You are purchasing a used instrument, not a professionally set-up guitar. Minor adjustments (intonation, action, tuning stability, etc.) are expected and are the buyer's responsibility. "Used" condition is not grounds for a return.

Communication

Questions are welcome before purchase. Message me anytime - I'd rather answer ten questions upfront than deal with a misunderstanding after the sale.`;

/**
 * Sweetwater's brand facet includes descriptive placeholders sellers pick when
 * an item has no real manufacturer. Matching them would shadow the actual
 * brand -- "Vintage" is longer than "Fender", so it would win on a title like
 * "Fender American Vintage II". They stay available in the review dropdown but
 * are never auto-derived.
 */
const NON_MANUFACTURER_BRANDS = new Set(
  ['N/A', 'Custom', 'None', 'Generic', 'No Brand', 'Vintage', 'Various', 'Partscaster', 'Custom Build', 'Handmade'].map(
    b => b.toLowerCase(),
  ),
);

/**
 * Longest-first so "Ernie Ball Music Man" is tested before the "Ernie Ball"
 * that is a prefix of it.
 */
const DERIVABLE_BRANDS = BRANDS.filter(b => !NON_MANUFACTURER_BRANDS.has(b.toLowerCase())).sort(
  (a, b) => b.length - a.length,
);

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Picks the brand appearing earliest in the title, since sellers lead with the
 * manufacturer and trailing words are usually finishes or models -- "Gibson Les
 * Paul ... Heritage Cherry" must not resolve to the Heritage brand. Ties go to
 * the longer name so "Ernie Ball Music Man" beats the "Ernie Ball" inside it.
 */
export function deriveBrand(title: string): string | null {
  let best: { brand: string; index: number } | null = null;

  for (const brand of DERIVABLE_BRANDS) {
    // \b alone fails on brands ending in punctuation such as "G&L".
    const match = title.match(new RegExp(`(^|[^a-z0-9])(${escapeRegex(brand)})([^a-z0-9]|$)`, 'i'));
    if (!match) continue;

    const index = match.index! + match[1].length;
    // DERIVABLE_BRANDS is longest-first, so a strict < keeps the longer name on ties.
    if (!best || index < best.index) best = { brand, index };
  }

  return best?.brand ?? null;
}

export interface CategoryGuess {
  top: string;
  sub: string;
  guessed: boolean;
}

/**
 * Keyword rules, most specific first. Every `sub` here is asserted against the
 * generated vocabulary by the test suite, so a Sweetwater rename breaks the
 * build rather than silently producing a rejected CSV row.
 */
const CATEGORY_RULES: { pattern: RegExp; top: string; sub: string }[] = [
  // Bass gear before guitars: "bass guitar" must not match the guitar rules.
  { pattern: /\bbass\b.*\b(head|amp head)\b|\bbass head\b/i, top: 'amplifiers', sub: 'bass-amp-heads' },
  { pattern: /\bbass\b.*\b(combo|amp)\b/i, top: 'amplifiers', sub: 'bass-combo-amps' },
  { pattern: /\bacoustic bass\b/i, top: 'bass-gear', sub: 'acoustic-bass-guitars' },
  { pattern: /\b(5|five)[- ]string\b.*\bbass\b|\bbass\b.*\b(5|five)[- ]string\b/i, top: 'bass-gear', sub: '5-string-bass-guitars' },
  { pattern: /\bbass\b/i, top: 'bass-gear', sub: '4-string-bass-guitars' },

  // Pedals and effects.
  { pattern: /\b(delay|reverb|echo)\b.*\bpedal\b|\bpedal\b.*\b(delay|reverb)\b|\b(dd-\d+|rv-\d+)\b/i, top: 'effects-and-pedals', sub: 'reverb-and-delay-pedals' },
  { pattern: /\b(overdrive|distortion|fuzz|boost|tube screamer|big muff)\b/i, top: 'effects-and-pedals', sub: 'distortion-overdrive-boost-and-fuzz' },
  { pattern: /\bchorus\b/i, top: 'effects-and-pedals', sub: 'chorus-pedals' },
  { pattern: /\b(wah|filter)\b/i, top: 'effects-and-pedals', sub: 'wah-and-filter-pedals' },

  // Amplifiers.
  { pattern: /\b(amp head|head)\b/i, top: 'amplifiers', sub: 'guitar-amp-heads' },
  { pattern: /\b(cabinet|cab|\d+x\d+)\b/i, top: 'amplifiers', sub: 'guitar-amp-cabinets' },
  { pattern: /\b(combo|amplifier|amp)\b/i, top: 'amplifiers', sub: 'guitar-combo-amps' },

  // Folk instruments.
  { pattern: /\bmandolin\b/i, top: 'folk-instruments', sub: 'mandolins' },
  { pattern: /\bbanjo\b/i, top: 'folk-instruments', sub: 'banjos' },
  { pattern: /\bukulele\b|\buke\b/i, top: 'folk-instruments', sub: 'ukuleles' },

  // Guitars.
  { pattern: /\b(semi-hollow|semi hollow|es-335|es335|es-339|casino)\b/i, top: 'guitars', sub: 'semi-hollow-guitars' },
  { pattern: /\b(hollowbody|hollow body|archtop|es-175|l-5)\b/i, top: 'guitars', sub: 'hollowbody-guitars' },
  { pattern: /\b12[- ]string\b/i, top: 'guitars', sub: '12-string-guitars' },
  { pattern: /\bacoustic\b|\bdreadnought\b|\bd-\d+\b|\bom-\d+\b|\bj-\d+\b/i, top: 'guitars', sub: '6-string-guitars' },
  { pattern: /\b(strat|stratocaster|tele|telecaster|les paul|lp|sg|jazzmaster|jaguar|mustang|firebird|explorer|flying v|solidbody)\b/i, top: 'guitars', sub: 'solidbody-guitars' },
];

const FALLBACK_CATEGORY = { top: 'guitars', sub: 'solidbody-guitars' };

export function deriveCategory(title: string): CategoryGuess {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(title)) return { top: rule.top, sub: rule.sub, guessed: false };
  }
  return { ...FALLBACK_CATEGORY, guessed: true };
}

export function deriveYear(title: string): string | null {
  const match = title.match(/\b(18[5-9]\d|19\d\d|20[0-3]\d)\b/);
  return match ? match[1] : null;
}

export function decadeForYear(year: string | null): string {
  if (!year) return '';
  const value = parseInt(year, 10);
  if (Number.isNaN(value)) return '';
  if (value < 1900) return 'pre 1900s';
  return `${Math.floor(value / 10) * 10}s`;
}

export interface ConditionGuess {
  value: string;
  guessed: boolean;
}

const CONDITION_MAP: Record<string, string> = {
  'brand new': 'Mint',
  new: 'Mint',
  mint: 'Mint',
  excellent: 'Excellent',
  'very good': 'Good',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

export function mapCondition(condition: string | null | undefined): ConditionGuess {
  const mapped = CONDITION_MAP[(condition ?? '').trim().toLowerCase()];
  return mapped ? { value: mapped, guessed: false } : { value: 'Excellent', guessed: true };
}

export function buildDescription(html: string | null | undefined): string {
  const body = htmlToPlainText(html ?? '');
  return body ? `${body}\n\n\n${RETURN_POLICY}` : RETURN_POLICY;
}

export function netPayout(price: number, method: PayoutMethod): number {
  if (method === 'store_credit') return price;
  const rate = (SWEETWATER_FEES.sellerFeePercent + SWEETWATER_FEES.transactionFeePercent) / 100;
  return price * (1 - rate);
}

export interface ExportListing {
  id: string;
  listing_title: string;
  description: string | null;
  condition: string | null;
  price: number;
  images: string[];
}

export interface ExportRow {
  id: string;
  title: string;
  brand: string;
  topCategory: string;
  subCategory: string;
  condition: string;
  year: string;
  decade: string;
  price: number;
  description: string;
  images: string[];
  /** True when any field fell back to a default the seller should eyeball. */
  needsReview: boolean;
}

export function deriveRow(listing: ExportListing): ExportRow {
  const title = listing.listing_title ?? '';
  const brand = deriveBrand(title);
  const category = deriveCategory(title);
  const condition = mapCondition(listing.condition);
  const year = deriveYear(title);

  return {
    id: listing.id,
    title: title.slice(0, MAX_TITLE_LENGTH),
    brand: brand ?? '',
    topCategory: category.top,
    subCategory: category.sub,
    condition: condition.value,
    year: year ?? '',
    decade: decadeForYear(year),
    price: listing.price,
    description: buildDescription(listing.description),
    images: (listing.images ?? []).slice(0, MAX_IMAGES).map(getFullQualityUrl),
    needsReview: category.guessed || condition.guessed || brand === null,
  };
}

/** Subcategories belonging to a top-level category, for the review dropdowns. */
export function subcategoriesFor(topCategory: string) {
  return SUBCATEGORIES.filter(s => s.top === topCategory);
}
