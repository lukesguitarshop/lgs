import { describe, expect, test } from 'vitest';
import { BULK_UPLOAD_COLUMNS, ROW_DEFAULTS, buildBulkUploadCsv } from './bulk-upload';
import type { ExportRow } from './derive';

const row: ExportRow = {
  id: 'a1',
  title: 'Fender Stratocaster',
  brand: 'Fender',
  topCategory: 'guitars',
  subCategory: 'solidbody-guitars',
  condition: 'Excellent',
  year: '2019',
  decade: '2010s',
  price: 1500,
  description: 'Great guitar.',
  images: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
  needsReview: false,
};

function parseHeader(csv: string) {
  return csv.split('\r\n')[0].split(',');
}

function parseCells(csv: string, lineIndex: number) {
  // Adequate for these fixtures: no field under test contains a comma.
  return csv.split('\r\n')[lineIndex].split(',');
}

describe('BULK_UPLOAD_COLUMNS', () => {
  test('matches the 45 columns of the Sweetwater template', () => {
    expect(BULK_UPLOAD_COLUMNS).toHaveLength(45);
    expect(BULK_UPLOAD_COLUMNS.slice(0, 8)).toEqual([
      'title',
      'brand',
      'top_category',
      'sub_category',
      'handedness',
      'condition',
      'decade',
      'year',
    ]);
    expect(BULK_UPLOAD_COLUMNS[44]).toBe('product_image_25');
  });
});

describe('buildBulkUploadCsv', () => {
  test('emits the header row first', () => {
    expect(parseHeader(buildBulkUploadCsv([row]))).toEqual([...BULK_UPLOAD_COLUMNS]);
  });

  test('omits the template instruction row, which Sweetwater requires deleting', () => {
    const csv = buildBulkUploadCsv([row]);
    expect(csv).not.toContain('Title required');
    expect(csv.split('\r\n')).toHaveLength(2);
  });

  test('writes one data row per listing', () => {
    expect(buildBulkUploadCsv([row, { ...row, id: 'a2' }]).split('\r\n')).toHaveLength(3);
  });

  test('places derived values in their template columns', () => {
    const cells = parseCells(buildBulkUploadCsv([row]), 1);
    const at = (column: string) => cells[BULK_UPLOAD_COLUMNS.indexOf(column)];

    expect(at('title')).toBe('Fender Stratocaster');
    expect(at('brand')).toBe('Fender');
    expect(at('top_category')).toBe('guitars');
    expect(at('sub_category')).toBe('solidbody-guitars');
    expect(at('condition')).toBe('Excellent');
    expect(at('year')).toBe('2019');
    expect(at('decade')).toBe('2010s');
  });

  test('rounds price to a whole number', () => {
    const csv = buildBulkUploadCsv([{ ...row, price: 1499.62 }]);
    const cells = parseCells(csv, 1);
    expect(cells[BULK_UPLOAD_COLUMNS.indexOf('price')]).toBe('1500');
  });

  test('applies the fixed shipping and offer defaults', () => {
    const cells = parseCells(buildBulkUploadCsv([row]), 1);
    const at = (column: string) => cells[BULK_UPLOAD_COLUMNS.indexOf(column)];

    expect(at('offers_enabled')).toBe('TRUE');
    expect(at('sale_optin')).toBe('FALSE');
    expect(at('sale_percent')).toBe(String(ROW_DEFAULTS.sale_percent));
    expect(at('shipping_price')).toBe('0');
  });

  test('quotes delivery_method because it contains a comma-free but spaced value', () => {
    expect(buildBulkUploadCsv([row])).toContain('Shipping and Local Pickup');
  });

  test('fills image columns in order and leaves the rest empty', () => {
    const cells = parseCells(buildBulkUploadCsv([row]), 1);
    expect(cells[BULK_UPLOAD_COLUMNS.indexOf('product_image_1')]).toBe('https://example.com/1.jpg');
    expect(cells[BULK_UPLOAD_COLUMNS.indexOf('product_image_2')]).toBe('https://example.com/2.jpg');
    expect(cells[BULK_UPLOAD_COLUMNS.indexOf('product_image_3')]).toBe('');
    expect(cells[BULK_UPLOAD_COLUMNS.indexOf('product_image_25')]).toBe('');
  });

  test('keeps a description containing commas and newlines in a single field', () => {
    const csv = buildBulkUploadCsv([{ ...row, description: 'Line one, with comma\nLine two' }]);
    expect(csv).toContain('"Line one, with comma\nLine two"');
  });

  test('leaves optional identifier columns blank', () => {
    const cells = parseCells(buildBulkUploadCsv([row]), 1);
    for (const column of ['Item_ID', 'serial', 'sku', 'mpn', 'video', 'handedness']) {
      expect(cells[BULK_UPLOAD_COLUMNS.indexOf(column)], column).toBe('');
    }
  });
});
