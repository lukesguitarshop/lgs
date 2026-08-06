#!/usr/bin/env node
/**
 * Generates frontend/lib/ebay/template.ts from an eBay "Create or Schedule new
 * listings" category template.
 *
 *   node scripts/parse-ebay-template.mjs <downloaded-template.csv>
 *
 * Re-run with a freshly downloaded template when eBay changes required aspects
 * or when you start listing in a new category. Download it from Seller Hub ->
 * Reports -> Download a template -> Create or Schedule new listings, selecting
 * every category you list into.
 *
 * The file eBay produces uses lone-CR line endings and a UTF-8 BOM.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/** Aspects worth constraining to eBay's published values. */
const TRACKED_ASPECTS = new Set([
  'Type',
  'Body Type',
  'String Configuration',
  'Handedness',
  'Body Color',
  'Amplifier Type',
  'Amplifier Technology',
  'Number of Speakers',
]);

function parse(csv) {
  const text = csv.replace(/^﻿/, '');
  const lines = text.split('\r');

  const columns = lines[1].split(',');
  if (!columns[0].startsWith('*Action(')) {
    throw new Error(`Expected the Action header on line 2, got: ${columns[0].slice(0, 60)}`);
  }

  const categories = {};
  let current = null;
  let brands = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith('Info,')) continue;

    // Guidance rows are quoted when their value list contains a comma.
    const body = line.slice(5).replace(/^"/, '').replace(/"$/, '').replace(/""/g, '"');

    let m;
    if ((m = body.match(/^>>> For categoryId:\s*(\d+)/))) {
      current = m[1];
      categories[current] ??= { id: current, required: [], values: {} };
    } else if ((m = body.match(/^>>> The required aspects are (.+)$/)) && current) {
      categories[current].required = m[1].split(';').map(s => s.trim()).filter(Boolean);
    } else if ((m = body.match(/^>>> The recommended value\(s\) for aspect ([^:]+):\s*(.+)$/)) && current) {
      const aspect = m[1].trim();
      const values = m[2].split(';').map(s => s.trim()).filter(Boolean);
      if (aspect === 'Brand' && values.length > brands.length) brands = values;
      if (TRACKED_ASPECTS.has(aspect)) categories[current].values[aspect] = values;
    }
  }

  if (!Object.keys(categories).length) throw new Error('No categories found in template');
  return { columns, categories, brands };
}

function render({ columns, categories, brands }, sourceName) {
  const j = v => JSON.stringify(v);
  const out = [];
  const push = (s = '') => out.push(s);

  push('// GENERATED FILE -- do not edit by hand.');
  push('// Regenerate with: node scripts/parse-ebay-template.mjs <template.csv>');
  push(`// Parsed from ${sourceName} on ${new Date().toISOString().slice(0, 10)}.`);
  push();
  push('/** Column header exactly as eBay emits it, including the * required markers. */');
  push('export const EBAY_COLUMNS: readonly string[] = [');
  for (const c of columns) push(`  ${j(c)},`);
  push('];');
  push();
  push('export interface CategoryAspects {');
  push('  id: string;');
  push('  /** Aspects eBay rejects the listing without. */');
  push('  required: readonly string[];');
  push('  /** Accepted values per aspect, where eBay publishes a closed list. */');
  push('  values: Readonly<Record<string, readonly string[]>>;');
  push('}');
  push();
  push('export const CATEGORY_ASPECTS: Readonly<Record<string, CategoryAspects>> = {');
  for (const [id, cat] of Object.entries(categories)) {
    push(`  ${j(id)}: {`);
    push(`    id: ${j(id)},`);
    push(`    required: [${cat.required.map(j).join(', ')}],`);
    push('    values: {');
    for (const [aspect, values] of Object.entries(cat.values)) {
      push(`      ${j(aspect)}: [${values.map(j).join(', ')}],`);
    }
    push('    },');
    push('  },');
  }
  push('};');
  push();
  push('/** Brand names as eBay spells them. Brand is required in every category. */');
  push('export const EBAY_BRANDS: readonly string[] = [');
  for (const b of brands) push(`  ${j(b)},`);
  push('];');
  push();

  return out.join('\n');
}

const source = process.argv[2];
if (!source) {
  console.error('Usage: node scripts/parse-ebay-template.mjs <downloaded-template.csv>');
  process.exit(1);
}

const parsed = parse(readFileSync(source, 'utf8'));
const outPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'lib', 'ebay', 'template.ts');
writeFileSync(outPath, render(parsed, source.split(/[\\/]/).pop()), 'utf8');

console.log(`Wrote ${outPath}`);
console.log(`  ${parsed.columns.length} columns`);
console.log(`  ${Object.keys(parsed.categories).length} categories: ${Object.keys(parsed.categories).join(', ')}`);
console.log(`  ${parsed.brands.length} brands`);
for (const [id, c] of Object.entries(parsed.categories)) {
  console.log(`    ${id} requires: ${c.required.join(', ') || '(none)'}`);
}
