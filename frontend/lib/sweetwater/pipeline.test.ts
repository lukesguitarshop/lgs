import { describe, expect, test } from 'vitest';
import { BULK_UPLOAD_COLUMNS, buildBulkUploadCsv } from './bulk-upload';
import { deriveRow, type ExportListing } from './derive';
import { SUBCATEGORIES, TOP_CATEGORIES } from './vocabulary';

/** Minimal RFC 4180 reader, so the assertions read the file the way Sweetwater will. */
function parseCsv(input: string): string[][] {
  const rows: string[][] = [[]];
  let field = '';
  let quoted = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      rows[rows.length - 1].push(field);
      field = '';
    } else if (char === '\r' && input[i + 1] === '\n') {
      rows[rows.length - 1].push(field);
      field = '';
      rows.push([]);
      i++;
    } else {
      field += char;
    }
  }
  rows[rows.length - 1].push(field);
  return rows;
}

const LISTINGS: ExportListing[] = [
  {
    id: '1',
    listing_title: 'Fender American Vintage II 1961 Stratocaster - Fiesta Red',
    description:
      '<p>This a great Stratocaster in a great color.</p><p>Barely played, no scratches.</p><b>Return Policy:</b> superseded policy text',
    condition: 'Mint',
    price: 1500,
    images: ['https://rvb-img.reverb.com/image/upload/a_exif,w=640/one.jpg', 'https://example.com/two.jpg'],
  },
  {
    id: '2',
    listing_title: '2019 Gibson Les Paul Standard 50s Heritage Cherry Sunburst',
    description: '<p>Plays great, minor buckle rash.</p>',
    condition: 'Very Good',
    price: 2299.99,
    images: [],
  },
  {
    id: '3',
    listing_title: 'Ibanez Tube Screamer TS9 Overdrive Pedal',
    description: null,
    condition: null,
    price: 129,
    images: [],
  },
  {
    id: '4',
    listing_title: 'Handmade partscaster, no branding',
    description: '<p>Mystery build.</p>',
    condition: 'Good',
    price: 400,
    images: [],
  },
];

describe('listing -> CSV pipeline', () => {
  const csv = buildBulkUploadCsv(LISTINGS.map(deriveRow));
  const rows = parseCsv(csv);
  const header = rows[0];
  const cell = (rowIndex: number, column: string) => rows[rowIndex][header.indexOf(column)];

  test('produces a header plus one row per listing', () => {
    expect(rows).toHaveLength(LISTINGS.length + 1);
  });

  test('every row carries all 45 columns even when fields are empty', () => {
    for (const row of rows) expect(row).toHaveLength(45);
  });

  test('derives brand, category, condition and dating for a vintage Fender', () => {
    expect(cell(1, 'brand')).toBe('Fender');
    expect(cell(1, 'top_category')).toBe('guitars');
    expect(cell(1, 'sub_category')).toBe('solidbody-guitars');
    expect(cell(1, 'condition')).toBe('Mint');
    expect(cell(1, 'year')).toBe('1961');
    expect(cell(1, 'decade')).toBe('1960s');
  });

  test('does not mistake a finish name for the manufacturer', () => {
    expect(cell(2, 'brand')).toBe('Gibson');
  });

  test('routes a pedal to the effects category', () => {
    expect(cell(3, 'top_category')).toBe('effects-and-pedals');
    expect(cell(3, 'sub_category')).toBe('distortion-overdrive-boost-and-fuzz');
  });

  test('leaves brand empty rather than guessing when no manufacturer is named', () => {
    expect(cell(4, 'brand')).toBe('');
  });

  test('replaces the old return policy instead of stacking both', () => {
    for (let i = 1; i <= LISTINGS.length; i++) {
      const description = cell(i, 'description');
      expect(description, `row ${i}`).toContain('15% restocking fee');
      expect(description, `row ${i}`).not.toContain('superseded policy text');
    }
  });

  test('keeps the multi-paragraph description intact inside one field', () => {
    expect(cell(1, 'description')).toContain('This a great Stratocaster in a great color.');
    expect(cell(1, 'description')).toContain('Barely played, no scratches.');
  });

  test('rounds prices to whole dollars', () => {
    expect(cell(2, 'price')).toBe('2300');
  });

  test('strips Reverb resize parameters from exported images', () => {
    expect(cell(1, 'product_image_1')).toBe('https://rvb-img.reverb.com/image/upload/one.jpg');
    expect(cell(1, 'product_image_2')).toBe('https://example.com/two.jpg');
    expect(cell(1, 'product_image_3')).toBe('');
  });

  test('every emitted category pair exists in the Sweetwater vocabulary', () => {
    const topCodes = new Set(TOP_CATEGORIES.map(t => t.code));
    for (let i = 1; i <= LISTINGS.length; i++) {
      const top = cell(i, 'top_category');
      const sub = cell(i, 'sub_category');
      expect(topCodes, `row ${i} top`).toContain(top);
      expect(SUBCATEGORIES.find(s => s.code === sub)?.top, `row ${i} sub`).toBe(top);
    }
  });

  test('emits the column set the template defines', () => {
    expect(header).toEqual([...BULK_UPLOAD_COLUMNS]);
  });
});
