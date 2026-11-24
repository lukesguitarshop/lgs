import type { CatalogListing } from './catalog';
import { brandPath, extractBrand, slugify } from './seo';

/**
 * Model families the shop sells often enough to deserve a page of their own
 * ("used Gibson Les Paul" is what people type, not "used Gibson guitars").
 *
 * This is a hand-kept list on purpose. Titles are free text, and guessing the model
 * from word position turns "Jackson Pro Series" and "Fender American Ultra" into
 * models. A family that is missing here simply has no page; nothing breaks.
 * Within a maker the first match wins, so put the more specific name first.
 */
interface ModelDef {
  brand: string;
  model: string;
  match: RegExp;
}

const MODELS: ModelDef[] = [
  { brand: 'Gibson', model: 'Les Paul', match: /\bles paul\b/i },
  { brand: 'Gibson', model: 'SG', match: /\bSG\b/ },
  { brand: 'Gibson', model: 'Flying V', match: /\bflying v\b/i },
  { brand: 'Gibson', model: 'Explorer', match: /\bexplorer\b/i },
  { brand: 'Gibson', model: 'Firebird', match: /\bfirebird\b/i },
  { brand: 'Epiphone', model: 'Les Paul', match: /\bles paul\b/i },
  { brand: 'Epiphone', model: 'SG', match: /\bSG\b/ },
  { brand: 'Fender', model: 'Stratocaster', match: /\bstrat(ocaster)?\b/i },
  { brand: 'Fender', model: 'Telecaster', match: /\btele(caster)?\b/i },
  { brand: 'Fender', model: 'Jazzmaster', match: /\bjazzmaster\b/i },
  { brand: 'Fender', model: 'Jaguar', match: /\bjaguar\b/i },
  { brand: 'PRS', model: 'Custom 24', match: /\bcustom 24\b/i },
  { brand: 'PRS', model: 'Custom 22', match: /\bcustom 22\b/i },
  { brand: 'PRS', model: 'CE 24', match: /\bCE[ -]?24\b/i },
  { brand: 'PRS', model: 'McCarty', match: /\bmccarty\b/i },
  { brand: 'PRS', model: 'Silver Sky', match: /\bsilver sky\b/i },
  { brand: 'ESP', model: 'Eclipse', match: /\b(eclipse|EC-?\d+)\b/i },
  { brand: 'ESP', model: 'Horizon', match: /\bhorizon\b/i },
  { brand: 'Kiesel', model: 'Aries', match: /\baries\b/i },
  { brand: 'Kiesel', model: 'Osiris', match: /\bosiris\b/i },
  { brand: 'Kiesel', model: 'Vader', match: /\bvader\b/i },
  { brand: 'Jackson', model: 'Soloist', match: /\bsoloist\b/i },
  { brand: 'Jackson', model: 'Dinky', match: /\bdinky\b/i },
  { brand: 'Jackson', model: 'Rhoads', match: /\brhoads\b/i },
  { brand: 'Schecter', model: 'C-1', match: /\bC-1\b/i },
  { brand: 'Ibanez', model: 'RG', match: /\bRGA?\d*[A-Z]*\b/ },
];

/** The model family named in a listing title, or null when it is not one we track. */
export function extractModel(title: string): { brand: string; model: string } | null {
  const brand = extractBrand(title);
  if (!brand) return null;
  const def = MODELS.find((entry) => entry.brand === brand && entry.match.test(title));
  return def ? { brand, model: def.model } : null;
}

export function modelPath(brand: string, model: string): string {
  return `${brandPath(brand)}/${slugify(model)}`;
}

/** The tracked model of this maker whose address ends in `slug`. */
export function modelFromSlug(brand: string, slug: string): string | null {
  const def = MODELS.find((entry) => entry.brand === brand && slugify(entry.model) === slug);
  return def ? def.model : null;
}

export function listingsForModel(
  listings: CatalogListing[],
  brand: string,
  model: string,
): CatalogListing[] {
  return listings.filter((listing) => {
    const found = extractModel(listing.listing_title);
    return found !== null && found.brand === brand && found.model === model;
  });
}

export interface ModelSummary {
  brand: string;
  model: string;
  inStock: number;
  sold: number;
}

/** Same bar as a maker's page: something for sale, or a sold record worth reading. */
export const MIN_SOLD_TO_INDEX_MODEL = 5;

export function isIndexableModel(summary: ModelSummary): boolean {
  return summary.inStock > 0 || summary.sold >= MIN_SOLD_TO_INDEX_MODEL;
}

/** Every tracked model that appears in the listings, most in stock first, then most sold. */
export function summarizeModels(active: CatalogListing[], sold: CatalogListing[]): ModelSummary[] {
  const counts = new Map<string, ModelSummary>();
  const bump = (listing: CatalogListing, key: 'inStock' | 'sold') => {
    const found = extractModel(listing.listing_title);
    if (!found) return;
    const id = `${found.brand}/${found.model}`;
    const entry = counts.get(id) ?? { ...found, inStock: 0, sold: 0 };
    entry[key] += 1;
    counts.set(id, entry);
  };
  active.forEach((listing) => bump(listing, 'inStock'));
  sold.forEach((listing) => bump(listing, 'sold'));
  return [...counts.values()].sort((a, b) => b.inStock - a.inStock || b.sold - a.sold);
}
