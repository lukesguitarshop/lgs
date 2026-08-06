/**
 * eBay leaf category IDs, read from eBay's own category navigation.
 *
 * There is no open taxonomy endpoint the way Sweetwater exposes Algolia, and
 * eBay blocks scripted fetches, so this list is curated rather than generated.
 * Verify an ID by loading https://www.ebay.com/b/x/<id>/ -- note that a
 * trailing `bn_...` token overrides the numeric ID, so leave it off.
 */
export interface EbayCategory {
  id: string;
  label: string;
}

export const EBAY_CATEGORIES: readonly EbayCategory[] = [
  { id: '33034', label: 'Electric Guitars' },
  { id: '33021', label: 'Acoustic Guitars' },
  { id: '22966', label: 'Acoustic Electric Guitars' },
  { id: '119544', label: 'Classical Guitars' },
  { id: '4713', label: 'Bass Guitars' },
  { id: '181163', label: 'Vintage Guitars & Basses' },
  { id: '621', label: 'Other Guitars' },
  { id: '38072', label: 'Guitar Amplifiers' },
  { id: '181222', label: 'Guitar Effects Pedals' },
  { id: '41408', label: 'Guitar Cases & Gig Bags' },
  { id: '22670', label: 'Guitar Pickups' },
  { id: '41424', label: 'Guitar Pickguards' },
  { id: '41423', label: 'Guitar Necks' },
  { id: '46677', label: 'Guitar Straps' },
  { id: '33050', label: 'Guitar Capos' },
  { id: '22671', label: 'Guitar Stands & Hangers' },
  { id: '22672', label: 'Guitar Tuners' },
  { id: '7266', label: 'Other Guitar & Bass Accessories' },
  { id: '180009', label: 'Guitar Parts & Accessories' },
  { id: '180016', label: 'String Instruments' },
  { id: '180010', label: 'Pianos, Keyboards & Organs' },
  { id: '180012', label: 'Percussion Instruments' },
  { id: '180014', label: 'Pro Audio Equipment' },
  { id: '48458', label: 'DJ Equipment' },
  { id: '16212', label: 'Brass Instruments' },
  { id: '10181', label: 'Wind & Woodwind Instruments' },
  { id: '12922', label: 'Stage Lighting & Effects' },
  { id: '308', label: 'Other Musical Instruments' },
];

/**
 * Categories under Guitars & Basses (3858), which carries eBay's reduced
 * final value fee. Everything else pays the standard rate.
 */
export const GUITARS_AND_BASSES_IDS: ReadonlySet<string> = new Set([
  '33034',
  '33021',
  '22966',
  '119544',
  '4713',
  '181163',
  '621',
]);

/** Used when nothing matches -- the shop's most common listing type. */
export const FALLBACK_CATEGORY_ID = '33034';

/**
 * Maps the Sweetwater subcategory codes the shared derivation already produces
 * onto eBay category IDs, so one set of keyword rules drives both exports.
 */
const BY_SWEETWATER_SUBCATEGORY: Record<string, string> = {
  'solidbody-guitars': '33034',
  'semi-hollow-guitars': '33034',
  'hollowbody-guitars': '33034',
  '6-string-guitars': '33021',
  '12-string-guitars': '33021',

  '4-string-bass-guitars': '4713',
  '5-string-bass-guitars': '4713',
  '6-string-bass-guitars': '4713',
  'acoustic-bass-guitars': '4713',
  'fretless-bass-guitars': '4713',

  'guitar-combo-amps': '38072',
  'guitar-amp-heads': '38072',
  'guitar-amp-cabinets': '38072',
  'bass-amp-heads': '38072',
  'bass-combo-amps': '38072',
  'bass-amp-cabinets': '38072',

  'distortion-overdrive-boost-and-fuzz': '181222',
  'reverb-and-delay-pedals': '181222',
  'chorus-pedals': '181222',
  'wah-and-filter-pedals': '181222',

  mandolins: '180016',
  banjos: '180016',
  ukuleles: '180016',

  // Accessories and parts. eBay rejects these outright when listed in an
  // instrument category ("It looks like you're listing an accessory or other
  // item in a category meant for guitars").
  'guitar-cases-and-gig-bags': '41408',
  'bass-guitar-cases': '41408',
  'guitar-pickups': '22670',
  'guitar-pickguards': '41424',
  'replacement-guitar-necks': '41423',
  'guitar-straps': '46677',
  'guitar-capos': '33050',
  'guitar-stands': '22671',
  'guitar-tuners': '22672',
  'guitar-cables': '7266',
  'guitar-slides': '7266',
  'pedalboards-and-power-supplies': '181222',
};

export function ebayCategoryForSubcategory(subCategory: string): string {
  return BY_SWEETWATER_SUBCATEGORY[subCategory] ?? FALLBACK_CATEGORY_ID;
}

export function categoryLabel(id: string): string {
  return EBAY_CATEGORIES.find(c => c.id === id)?.label ?? id;
}
