import { getFullQualityUrl } from '../html-text';
import { toCsv, type CsvCell } from '../sweetwater/csv';
import { deriveBrand, deriveCategory, type ExportListing } from '../sweetwater/derive';
import { ebayCategoryForSubcategory, GUITARS_AND_BASSES_IDS } from './categories';
import { stripReturnPolicyHtml, returnPolicyHtml } from './description';
import { CATEGORY_ASPECTS, EBAY_COLUMNS } from './template';

export const MAX_EBAY_TITLE = 80;
export const MAX_EBAY_PHOTOS = 24;
const PHOTO_SEPARATOR = '|';

/**
 * The category template rejects `Draft` with "Unable to find Task Action Id
 * for task Draft" -- that action only exists in the draft-listings template.
 * `VerifyAdd` validates every row and reports errors without creating
 * anything, so it is the safe first pass before switching to `Add`.
 */
export type ListingAction = 'VerifyAdd' | 'Add';

export const LISTING_DEFAULTS = {
  /**
   * Listings publish on upload. `VerifyAdd` stays available in the review
   * modal as a dry run -- worth using for a batch containing categories the
   * downloaded templates do not cover, since those fill Brand only.
   */
  action: 'Add' as ListingAction,
  format: 'FixedPrice',
  duration: 'GTC',
  quantity: 1,
  location: 'Columbus, OH',
  /** Handling days before dispatch. */
  dispatchTimeMax: 3,
  bestOfferEnabled: 1,
  /**
   * Mutually exclusive with Best Offer -- setting both earns eBay warning
   * 23015, "If this item sells by a Best Offer, you will not be able to
   * require immediate payment." Offers win, so this stays off.
   */
  immediatePayRequired: 0,
  shippingType: 'Flat',
  shippingService: 'UPSGround',
  shippingCost: 0,
  /** Matches the shop's stated all-sales-final policy. */
  returnsAcceptedOption: 'ReturnsNotAccepted',
} as const;

/** eBay numeric condition IDs. The full template wants these, not the enums. */
const CONDITION_MAP: Record<string, string> = {
  'brand new': '1000',
  new: '1000',
  mint: '3000',
  excellent: '3000',
  'very good': '3000',
  good: '3000',
  fair: '3000',
  poor: '7000',
};

export function conditionIdFor(condition: string | null | undefined): string {
  return CONDITION_MAP[(condition ?? '').trim().toLowerCase()] ?? '3000';
}

/**
 * eBay truncates at 80 characters and flags a title that lands exactly on the
 * limit, so cut back to the last whole word instead.
 */
export function truncateTitle(title: string): string {
  if (title.length <= MAX_EBAY_TITLE) return title;
  const clipped = title.slice(0, MAX_EBAY_TITLE);
  const lastSpace = clipped.lastIndexOf(' ');
  return lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped;
}

function allowed(categoryId: string, aspect: string): readonly string[] {
  return CATEGORY_ASPECTS[categoryId]?.values[aspect] ?? [];
}

/** Returns `value` when the category accepts it, otherwise the first fallback it does. */
function snap(categoryId: string, aspect: string, value: string, ...fallbacks: string[]): string {
  const options = allowed(categoryId, aspect);
  if (!options.length) return '';
  for (const candidate of [value, ...fallbacks]) {
    if (options.includes(candidate)) return candidate;
  }
  return options[0];
}

/**
 * Best-effort Type for categories the downloaded template does not cover.
 * eBay requires Type in accessory categories and rejects a blank, so a
 * plausible starting value beats nothing -- these are editable in the review
 * table, and re-running the template parser with the accessory categories
 * selected replaces the guesswork with eBay's published list.
 */
const UNMAPPED_TYPE_RULES: [RegExp, string][] = [
  [/\bgig ?bag\b/i, 'Gig Bag'],
  [/\bsoft ?case\b/i, 'Soft Case'],
  [/\b(hard ?shell|hard ?case|flight case)\b/i, 'Hard Case'],
  [/\bhumbucker\b/i, 'Humbucker'],
  [/\bsingle[- ]coil\b/i, 'Single Coil'],
  [/\bpickup\b/i, 'Humbucker'],
];

function unmappedType(title: string): string {
  for (const [pattern, value] of UNMAPPED_TYPE_RULES) {
    if (pattern.test(title)) return value;
  }
  return '';
}

export function deriveType(categoryId: string, title: string): string {
  const options = allowed(categoryId, 'Type');

  if (!options.length) {
    // No published list: either the category needs no Type, or the template
    // never covered it. Amps genuinely have no Type aspect.
    return CATEGORY_ASPECTS[categoryId] ? '' : unmappedType(title);
  }
  if (options.length === 1) return options[0];

  for (const [pattern, value] of TYPE_RULES[categoryId] ?? []) {
    if (pattern.test(title)) return snap(categoryId, 'Type', value);
  }
  return snap(categoryId, 'Type', TYPE_FALLBACKS[categoryId] ?? options[0]);
}

/**
 * Title patterns to Type values, per category. Values come from the generated
 * template, so a Sweetwater-style rename breaks the tests rather than the
 * upload.
 */
const TYPE_RULES: Record<string, [RegExp, string][]> = {
  // Bass Guitars
  '4713': [
    [/\bacoustic[- ]electric\b/i, 'Acoustic-Electric Bass Guitar'],
    [/\bacoustic\b/i, 'Acoustic Bass Guitar'],
  ],
  // Guitar Cases -- eBay accepts only Cover, Gig Bag and Hard Case.
  '41408': [
    [/\b(gig ?bag|soft ?case|padded bag)\b/i, 'Gig Bag'],
    [/\b(hard ?shell|hard ?case|flight case|tolex)\b/i, 'Hard Case'],
    [/\bcover\b/i, 'Cover'],
  ],
  // Guitar Pickups
  '22670': [
    [/\bmini[- ]?humbucker\b/i, 'Mini-Humbucker Pickup'],
    [/\b(p-?90|soapbar)\b/i, 'Soapbar Pickup'],
    [/\bpiezo\b/i, 'Piezo Pickup'],
    [/\bsoundhole\b/i, 'Soundhole Pickup'],
    [/\blipstick\b/i, 'Lipstick Pickup'],
    [/\bsingle[- ]coil\b/i, 'Single Coil Pickup'],
    [/\bhumbucker\b/i, 'Humbucker Pickup'],
  ],
};

const TYPE_FALLBACKS: Record<string, string> = {
  '4713': 'Electric Bass Guitar',
  '41408': 'Hard Case',
  '22670': 'Humbucker Pickup',
};

export function deriveBodyType(categoryId: string, title: string): string {
  if (/\b(semi-hollow|semi hollow|es-335|es335|es-339|casino)\b/i.test(title)) {
    return snap(categoryId, 'Body Type', 'Semi-Hollow', 'Hollow', 'Solid');
  }
  if (/\b(hollowbody|hollow body|archtop|es-175|l-5)\b/i.test(title)) {
    return snap(categoryId, 'Body Type', 'Hollow', 'Semi-Hollow', 'Solid');
  }
  if (/\bfretless\b/i.test(title)) return snap(categoryId, 'Body Type', 'Fretless', 'Solid');
  if (/\bjumbo\b/i.test(title)) return snap(categoryId, 'Body Type', 'Jumbo', 'Dreadnought');
  if (/\bparlou?r\b/i.test(title)) return snap(categoryId, 'Body Type', 'Parlor', 'Dreadnought');

  // Acoustic categories have no "Solid", electric categories have no "Dreadnought".
  return snap(categoryId, 'Body Type', 'Solid', 'Dreadnought');
}

export function deriveStringConfiguration(title: string, categoryId: string): string {
  const match = title.match(/\b(4|5|6|7|8|9|10|12)[- ]?string\b/i);
  if (match) return snap(categoryId, 'String Configuration', `${match[1]} String`);
  if (/\bbass\b/i.test(title) || categoryId === '4713') {
    return snap(categoryId, 'String Configuration', '4 String');
  }
  return snap(categoryId, 'String Configuration', '6 String');
}

export function deriveHandedness(title: string, categoryId = '33034'): string {
  const value = /\b(left[- ]handed|lefty|left hand|lh)\b/i.test(title) ? 'Left-Handed' : 'Right-Handed';
  return snap(categoryId, 'Handedness', value);
}

/**
 * eBay only accepts 16 basic colours, so guitar finish names have to be
 * collapsed -- "Fiesta Red" becomes Red, "Heritage Cherry Sunburst" becomes
 * Brown. Ordered most specific first.
 */
const COLOR_RULES: [RegExp, string][] = [
  [/\b(goldtop|gold top|gold)\b/i, 'Gold'],
  [/\b(sunburst|tobacco|walnut|mahogany|amber|natural relic)\b/i, 'Brown'],
  [/\b(blonde|butterscotch|vintage white|cream|ivory|natural)\b/i, 'Beige'],
  [/\b(olympic white|arctic white|white)\b/i, 'White'],
  [/\b(black|ebony|noir)\b/i, 'Black'],
  [/\b(fiesta red|candy apple|cherry|crimson|red)\b/i, 'Red'],
  [/\b(lake placid|sonic blue|daphne|ocean turquoise|blue)\b/i, 'Blue'],
  [/\b(surf green|sea ?foam|green)\b/i, 'Green'],
  [/\b(silver|pewter|chrome)\b/i, 'Silver'],
  [/\b(orange)\b/i, 'Orange'],
  [/\b(purple|violet)\b/i, 'Purple'],
  [/\b(pink|shell pink)\b/i, 'Pink'],
  [/\b(gray|grey|charcoal)\b/i, 'Gray'],
  [/\b(sparkle|rainbow|multicolor)\b/i, 'Multicolor'],
];

export function deriveBodyColor(title: string, categoryId = '33034'): string {
  for (const [pattern, colour] of COLOR_RULES) {
    if (pattern.test(title)) return snap(categoryId, 'Body Color', colour);
  }
  return '';
}

export function deriveAmplifierType(title: string): string {
  if (/\b(full stack|half stack|stack)\b/i.test(title)) return 'Stack';
  if (/\b(cabinet|cab|\d+x\d+)\b/i.test(title)) return 'Cabinet';
  if (/\b(amp head|head)\b/i.test(title)) return 'Head';
  return 'Combo';
}

export interface EbayListingRow {
  id: string;
  title: string;
  categoryId: string;
  conditionId: string;
  brand: string;
  type: string;
  bodyType: string;
  stringConfiguration: string;
  handedness: string;
  bodyColor: string;
  amplifierType: string;
  price: number;
  description: string;
  images: string[];
  needsReview: boolean;
}

const AMPLIFIER_CATEGORY = '38072';

export function deriveListingRow(listing: ExportListing): EbayListingRow {
  const rawTitle = listing.listing_title ?? '';
  const category = deriveCategory(rawTitle);
  const categoryId = ebayCategoryForSubcategory(category.sub);
  const brand = deriveBrand(rawTitle);
  const isAmp = categoryId === AMPLIFIER_CATEGORY;

  return {
    id: listing.id,
    title: truncateTitle(rawTitle),
    categoryId,
    conditionId: conditionIdFor(listing.condition),
    // Brand is required in every category, so fall back rather than emit blank.
    brand: brand ?? 'Unbranded',
    type: deriveType(categoryId, rawTitle),
    bodyType: deriveBodyType(categoryId, rawTitle),
    stringConfiguration: deriveStringConfiguration(rawTitle, categoryId),
    handedness: deriveHandedness(rawTitle, categoryId),
    bodyColor: deriveBodyColor(rawTitle, categoryId),
    amplifierType: isAmp ? deriveAmplifierType(rawTitle) : '',
    price: listing.price,
    description: `${stripReturnPolicyHtml(listing.description ?? '')}${returnPolicyHtml()}`,
    images: (listing.images ?? []).slice(0, MAX_EBAY_PHOTOS).map(getFullQualityUrl),
    needsReview:
      category.guessed ||
      brand === null ||
      rawTitle.length > MAX_EBAY_TITLE ||
      // Accessory and parts categories were not in the downloaded template, so
      // their required aspects are unknown and only Brand gets filled.
      !CATEGORY_ASPECTS[categoryId],
  };
}

export interface BuildOptions {
  action?: ListingAction;
  shippingService?: string;
}

export function buildListingCsv(rows: EbayListingRow[], options: BuildOptions = {}): string {
  const action = options.action ?? LISTING_DEFAULTS.action;
  const shippingService = options.shippingService ?? LISTING_DEFAULTS.shippingService;

  const body = rows.map(row => {
    const cells: Record<string, CsvCell> = {
      '*Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8)': action,
      CustomLabel: row.id,
      '*Category': row.categoryId,
      '*Title': row.title,
      '*ConditionID': row.conditionId,
      '*C:Brand': row.brand,
      '*C:Type': row.type,
      'C:String Configuration': row.stringConfiguration,
      'C:Body Type': row.bodyType,
      'C:Handedness': row.handedness,
      'C:Body Color': row.bodyColor,
      '*C:Amplifier Type': row.amplifierType,
      PicURL: row.images.join(PHOTO_SEPARATOR),
      '*Description': row.description,
      '*Format': LISTING_DEFAULTS.format,
      '*Duration': LISTING_DEFAULTS.duration,
      '*StartPrice': Math.round(row.price * 100) / 100,
      BestOfferEnabled: LISTING_DEFAULTS.bestOfferEnabled,
      '*Quantity': LISTING_DEFAULTS.quantity,
      ImmediatePayRequired: LISTING_DEFAULTS.immediatePayRequired,
      '*Location': LISTING_DEFAULTS.location,
      ShippingType: LISTING_DEFAULTS.shippingType,
      'ShippingService-1:Option': shippingService,
      'ShippingService-1:Cost': LISTING_DEFAULTS.shippingCost,
      '*DispatchTimeMax': LISTING_DEFAULTS.dispatchTimeMax,
      '*ReturnsAcceptedOption': LISTING_DEFAULTS.returnsAcceptedOption,
    };
    return EBAY_COLUMNS.map(column => cells[column] ?? '');
  });

  return toCsv([
    ['Info', 'Version=1.0.0', 'Template=fx_category_template_EBAY_US'],
    [...EBAY_COLUMNS],
    ...body,
  ]);
}

export { GUITARS_AND_BASSES_IDS };
