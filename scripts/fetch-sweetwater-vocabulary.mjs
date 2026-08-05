#!/usr/bin/env node
/**
 * Regenerates frontend/lib/sweetwater/vocabulary.ts from Sweetwater's public
 * Gear Exchange Algolia index (the same index the deal finder scrapes).
 *
 * Run when Sweetwater adds categories or brands:
 *   node scripts/fetch-sweetwater-vocabulary.mjs
 *
 * Why generate instead of hardcode: the bulk-upload CSV rejects unknown
 * category codes, and the template only documents one example per top
 * category. The Algolia facets carry the full tree.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const APP_ID = 'E2O5C5M9LS';
const API_KEY = '013abf8e573fc605f7b8d69f15711113';
const INDEX = 'production_listings';

/**
 * The 12 top-level codes the bulk-upload template accepts, in template order.
 * These are NOT derivable from the Algolia display names -- Sweetwater uses
 * "Bass" but the CSV wants "bass-gear", "Drum & Percussion" but "drums-and-percussion".
 * Taken verbatim from GX_Mass_Upload.csv, which is authoritative.
 */
const TOP_CATEGORIES = [
  { code: 'guitars', label: 'Guitars', algolia: 'Guitars' },
  { code: 'effects-and-pedals', label: 'Effects & Pedals', algolia: 'Effects & Pedals' },
  { code: 'amplifiers', label: 'Amplifiers', algolia: 'Amplifiers' },
  { code: 'bass-gear', label: 'Bass', algolia: 'Bass' },
  { code: 'keyboards-and-synthesizers', label: 'Keyboards & Synthesizers', algolia: 'Keyboards & Synthesizers' },
  { code: 'microphones-and-wireless', label: 'Microphones & Wireless', algolia: 'Microphones & Wireless' },
  { code: 'live-sound-and-lighting', label: 'Live Sound & Lighting', algolia: 'Live Sound & Lighting' },
  { code: 'studio-recording-gear', label: 'Studio & Recording Gear', algolia: 'Studio & Recording Gear' },
  { code: 'drums-and-percussion', label: 'Drum & Percussion', algolia: 'Drum & Percussion' },
  { code: 'band-and-orchestra', label: 'Band & Orchestra', algolia: 'Band & Orchestra' },
  { code: 'dj-electronic', label: 'DJ / Electronic', algolia: 'DJ / Electronic' },
  { code: 'folk-instruments', label: 'Folk Instruments', algolia: 'Folk Instruments' },
];

/**
 * Leaf categories that exist on Sweetwater but had zero live listings when the
 * facets were pulled, so Algolia omitted them. Both appear in the CSV template.
 */
const SEEDED_SUBCATEGORIES = [
  { code: 'eurorack-modular-synths', label: 'Eurorack Modular Synths', top: 'keyboards-and-synthesizers' },
  { code: 'turntables-and-accessories', label: 'Turntables & Accessories', top: 'dj-electronic' },
];

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\+/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function queryFacets(facets) {
  const res = await fetch(`https://${APP_ID}-dsn.algolia.net/1/indexes/${INDEX}/query`, {
    method: 'POST',
    headers: {
      'X-Algolia-Application-Id': APP_ID,
      'X-Algolia-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: '', hitsPerPage: 0, facets, maxValuesPerFacet: 1000 }),
  });
  if (!res.ok) throw new Error(`Algolia returned ${res.status} ${res.statusText}`);
  const body = await res.json();
  if (!body.facets) throw new Error('Algolia response contained no facets');
  return body.facets;
}

function buildSubcategories(facets) {
  const topByAlgolia = new Map(TOP_CATEGORIES.map(t => [t.algolia, t.code]));

  // Both tree levels are valid sub_category codes. The template uses the
  // level-2 "solidbody-guitars" but also the level-1 "brass-instruments",
  // which has children beneath it -- so depth does not decide validity.
  const paths = [...Object.keys(facets.cat_lvl_1 ?? {}), ...Object.keys(facets.cat_lvl_2 ?? {})];

  const seen = new Map();
  for (const path of paths) {
    const parts = path.split(' >> ');
    const top = topByAlgolia.get(parts[0]);
    if (!top) continue; // e.g. "Home Audio Gear" has no bulk-upload code

    const label = parts[parts.length - 1];
    const code = slugify(label);
    if (!seen.has(code)) seen.set(code, { code, label, top, depth: parts.length - 1 });
  }

  for (const seed of SEEDED_SUBCATEGORIES) {
    if (!seen.has(seed.code)) seen.set(seed.code, { ...seed, depth: 1 });
  }

  // Group by top category, broader codes before the narrower ones under them.
  return [...seen.values()].sort(
    (a, b) => a.top.localeCompare(b.top) || a.depth - b.depth || a.code.localeCompare(b.code),
  );
}

function render(subcategories, brands, conditions, decades) {
  const lines = [];
  const push = (s = '') => lines.push(s);

  push('// GENERATED FILE -- do not edit by hand.');
  push('// Regenerate with: node scripts/fetch-sweetwater-vocabulary.mjs');
  push(`// Pulled from Sweetwater's public Gear Exchange Algolia index on ${new Date().toISOString().slice(0, 10)}.`);
  push();
  push('export interface SweetwaterCategory {');
  push('  code: string;');
  push('  label: string;');
  push('}');
  push();
  push('export interface SweetwaterSubcategory extends SweetwaterCategory {');
  push('  /** code of the owning top-level category */');
  push('  top: string;');
  push('}');
  push();
  push('export const TOP_CATEGORIES: readonly SweetwaterCategory[] = [');
  for (const t of TOP_CATEGORIES) {
    push(`  { code: ${JSON.stringify(t.code)}, label: ${JSON.stringify(t.label)} },`);
  }
  push('];');
  push();
  push('export const SUBCATEGORIES: readonly SweetwaterSubcategory[] = [');
  for (const s of subcategories) {
    push(`  { code: ${JSON.stringify(s.code)}, label: ${JSON.stringify(s.label)}, top: ${JSON.stringify(s.top)} },`);
  }
  push('];');
  push();
  push('/** Brand names as Sweetwater spells them, most-listed first. */');
  push('export const BRANDS: readonly string[] = [');
  for (const b of brands) push(`  ${JSON.stringify(b)},`);
  push('];');
  push();
  push(`export const CONDITIONS: readonly string[] = [${conditions.map(c => JSON.stringify(c)).join(', ')}];`);
  push();
  push(`export const DECADES: readonly string[] = [${decades.map(d => JSON.stringify(d)).join(', ')}];`);
  push();

  return lines.join('\n');
}

async function main() {
  const facets = await queryFacets(['cat_lvl_1', 'cat_lvl_2', 'brand', 'condition', 'made_decade']);

  const subcategories = buildSubcategories(facets);
  const brands = Object.entries(facets.brand ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
    .filter(name => name !== 'Unbranded' && name !== 'ETC');
  const conditions = ['Mint', 'Excellent', 'Good', 'Fair', 'Poor'];
  const decades = Object.keys(facets.made_decade ?? {}).sort((a, b) => {
    if (a === 'pre 1900s') return -1;
    if (b === 'pre 1900s') return 1;
    return parseInt(a, 10) - parseInt(b, 10);
  });

  const outPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'frontend',
    'lib',
    'sweetwater',
    'vocabulary.ts',
  );
  writeFileSync(outPath, render(subcategories, brands, conditions, decades), 'utf8');

  console.log(`Wrote ${outPath}`);
  console.log(`  ${TOP_CATEGORIES.length} top categories`);
  console.log(`  ${subcategories.length} subcategories`);
  console.log(`  ${brands.length} brands`);
  console.log(`  ${decades.length} decades`);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
