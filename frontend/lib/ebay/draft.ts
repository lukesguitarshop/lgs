import { getFullQualityUrl } from '../html-text';
import { toCsv, type CsvCell } from '../sweetwater/csv';
import { deriveCategory, RETURN_POLICY, type ExportListing } from '../sweetwater/derive';
import { ebayCategoryForSubcategory, GUITARS_AND_BASSES_IDS } from './categories';

/** eBay caps listing titles at 80 characters, well below Sweetwater's 150. */
export const MAX_EBAY_TITLE = 80;

/** eBay allows 24 photos per listing. */
export const MAX_EBAY_PHOTOS = 24;

/** Multiple image URLs share one column, pipe separated. */
const PHOTO_SEPARATOR = '|';

/**
 * Final value fees. Guitars & Basses carries eBay's reduced music rate; the
 * rest of Musical Instruments & Gear does not.
 * https://www.ebayinc.com/stories/news/ebay-reduces-fees-for-music-enthusiasts/
 */
export const EBAY_FEES = {
  guitarsAndBassesPercent: 6.7,
  standardPercent: 13.6,
  perOrderFee: 0.4,
  perOrderFeeReduced: 0.3,
  /** Orders at or below this total pay the reduced per-order fee. */
  perOrderFeeThreshold: 10,
} as const;

/**
 * Comment rows eBay ships at the top of the template. Lines beginning with `#`
 * are ignored by the importer, but the Version and Template identifiers are
 * kept so the file stays recognisable as an unmodified draft template.
 */
export const DRAFT_INFO_ROWS: readonly CsvCell[][] = [
  ['#INFO', 'Version=0.0.2', 'Template= eBay-draft-listings-template_US', '', '', '', '', '', '', '', ''],
  [
    '#INFO Action and Category ID are required fields. 1) Set Action to Draft 2) Please find the category ID for your listings here: https://pages.ebay.com/sellerinformation/news/categorychanges.html',
    '', '', '', '', '', '', '', '', '', '',
  ],
  [
    "#INFO After you've successfully uploaded your draft from the Seller Hub Reports tab, complete your drafts to active listings here: https://www.ebay.com/sh/lst/drafts",
    '', '', '', '', '', '', '', '', '', '',
  ],
  ['#INFO', '', '', '', '', '', '', '', '', '', ''],
];

/**
 * Column order from the downloaded template. The Action header carries site
 * metadata eBay parses, so it must be reproduced exactly.
 */
export const DRAFT_COLUMNS = [
  'Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8)',
  'Custom label (SKU)',
  'Category ID',
  'Title',
  'UPC',
  'Price',
  'Quantity',
  'Item photo URL',
  'Condition ID',
  'Description',
  'Format',
] as const;

export const ROW_DEFAULTS = {
  action: 'Draft',
  quantity: 1,
  format: 'FixedPrice',
  /** Used and vintage gear rarely carries a barcode. */
  upc: 'Does not apply',
} as const;

/**
 * eBay condition enums. Guitars & Basses does not expose the granular
 * USED_VERY_GOOD / USED_GOOD tiers that media categories do, so every used
 * grade maps onto USED_EXCELLENT, which displays simply as "Used".
 */
const CONDITION_MAP: Record<string, string> = {
  'brand new': 'NEW',
  new: 'NEW',
  mint: 'USED_EXCELLENT',
  excellent: 'USED_EXCELLENT',
  'very good': 'USED_EXCELLENT',
  good: 'USED_EXCELLENT',
  fair: 'USED_EXCELLENT',
  poor: 'FOR_PARTS_OR_NOT_WORKING',
};

export const EBAY_CONDITIONS = ['NEW', 'USED_EXCELLENT', 'FOR_PARTS_OR_NOT_WORKING'] as const;

export function ebayConditionFor(condition: string | null | undefined): string {
  return CONDITION_MAP[(condition ?? '').trim().toLowerCase()] ?? 'USED_EXCELLENT';
}

/**
 * Removes the stored return-policy block while leaving the surrounding markup
 * intact -- eBay renders HTML descriptions, so unlike the Facebook and
 * Sweetwater exports the tags are worth keeping.
 */
export function stripReturnPolicyHtml(html: string): string {
  return html
    .replace(/(<b>|<strong>)*\s*Return Policy\s*:?\s*(<\/b>|<\/strong>)*[\s\S]*/i, '')
    .trim();
}

function returnPolicyHtml(): string {
  const paragraphs = RETURN_POLICY.split('\n\n')
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('');
  return paragraphs;
}

export function ebayNetPayout(price: number, categoryId: string): number {
  const percent = GUITARS_AND_BASSES_IDS.has(categoryId)
    ? EBAY_FEES.guitarsAndBassesPercent
    : EBAY_FEES.standardPercent;
  const perOrder =
    price <= EBAY_FEES.perOrderFeeThreshold ? EBAY_FEES.perOrderFeeReduced : EBAY_FEES.perOrderFee;
  return price - (price * percent) / 100 - perOrder;
}

export interface EbayRow {
  id: string;
  title: string;
  categoryId: string;
  conditionId: string;
  price: number;
  description: string;
  images: string[];
  needsReview: boolean;
}

export function deriveEbayRow(listing: ExportListing): EbayRow {
  const title = listing.listing_title ?? '';
  const category = deriveCategory(title);
  const body = stripReturnPolicyHtml(listing.description ?? '');

  return {
    id: listing.id,
    title: title.slice(0, MAX_EBAY_TITLE),
    categoryId: ebayCategoryForSubcategory(category.sub),
    conditionId: ebayConditionFor(listing.condition),
    price: listing.price,
    description: `${body}${returnPolicyHtml()}`,
    images: (listing.images ?? []).slice(0, MAX_EBAY_PHOTOS).map(getFullQualityUrl),
    // The title was too long to survive intact, or the category was a fallback.
    needsReview: category.guessed || title.length > MAX_EBAY_TITLE,
  };
}

export function buildDraftCsv(rows: EbayRow[]): string {
  const body: CsvCell[][] = rows.map(row => [
    ROW_DEFAULTS.action,
    row.id,
    row.categoryId,
    row.title,
    ROW_DEFAULTS.upc,
    Math.round(row.price * 100) / 100,
    ROW_DEFAULTS.quantity,
    row.images.join(PHOTO_SEPARATOR),
    row.conditionId,
    row.description,
    ROW_DEFAULTS.format,
  ]);

  return toCsv([...DRAFT_INFO_ROWS, [...DRAFT_COLUMNS], ...body]);
}
