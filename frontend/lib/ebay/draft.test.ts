import { describe, expect, test } from 'vitest';
import {
  DRAFT_COLUMNS,
  DRAFT_INFO_ROWS,
  EBAY_FEES,
  buildDraftCsv,
  deriveEbayRow,
  ebayConditionFor,
  ebayNetPayout,
  stripReturnPolicyHtml,
  MAX_EBAY_TITLE,
  MAX_EBAY_PHOTOS,
} from './draft';
import { EBAY_CATEGORIES } from './categories';

const listing = {
  id: 'abc123',
  listing_title: '2019 Fender American Professional Stratocaster',
  description: '<p>Excellent player.</p>',
  condition: 'Excellent',
  price: 1500,
  images: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
};

function parseCsv(input: string): string[][] {
  const rows: string[][] = [[]];
  let field = '';
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { rows[rows.length - 1].push(field); field = ''; }
    else if (c === '\r' && input[i + 1] === '\n') { rows[rows.length - 1].push(field); field = ''; rows.push([]); i++; }
    else field += c;
  }
  rows[rows.length - 1].push(field);
  return rows;
}

describe('ebayConditionFor', () => {
  test.each([
    ['Brand New', 'NEW'],
    ['Mint', 'USED_EXCELLENT'],
    ['Excellent', 'USED_EXCELLENT'],
    ['Very Good', 'USED_EXCELLENT'],
    ['Good', 'USED_EXCELLENT'],
    ['Fair', 'USED_EXCELLENT'],
    ['Poor', 'FOR_PARTS_OR_NOT_WORKING'],
  ])('maps %s to %s', (site, expected) => {
    expect(ebayConditionFor(site)).toBe(expected);
  });

  test('defaults an unknown condition to used rather than new', () => {
    expect(ebayConditionFor(null)).toBe('USED_EXCELLENT');
  });
});

describe('stripReturnPolicyHtml', () => {
  test('drops the old return policy block but keeps the HTML above it', () => {
    const result = stripReturnPolicyHtml('<p>Nice guitar.</p><b>Return Policy:</b> old terms');
    expect(result).toContain('<p>Nice guitar.</p>');
    expect(result).not.toContain('old terms');
  });

  test('preserves markup, unlike the plain-text exports', () => {
    expect(stripReturnPolicyHtml('<p>Hi</p><br>')).toContain('<p>');
  });
});

describe('ebayNetPayout', () => {
  test('applies the reduced guitars and basses rate', () => {
    // 1000 - 6.7% - 0.40 per order
    expect(ebayNetPayout(1000, '33034')).toBeCloseTo(1000 - 67 - 0.4, 2);
  });

  test('applies the standard rate outside guitars and basses', () => {
    expect(ebayNetPayout(1000, '181222')).toBeCloseTo(1000 - 136 - 0.4, 2);
  });

  test('charges the lower per-order fee on cheap items', () => {
    expect(ebayNetPayout(8, '33034')).toBeCloseTo(8 - 8 * 0.067 - 0.3, 2);
  });

  test('exposes both published rates', () => {
    expect(EBAY_FEES.guitarsAndBassesPercent).toBeCloseTo(6.7, 5);
    expect(EBAY_FEES.standardPercent).toBeCloseTo(13.6, 5);
  });
});

describe('deriveEbayRow', () => {
  test('derives category, condition and title', () => {
    const row = deriveEbayRow(listing);
    expect(row).toMatchObject({
      id: 'abc123',
      title: '2019 Fender American Professional Stratocaster',
      categoryId: '33034',
      conditionId: 'USED_EXCELLENT',
      price: 1500,
    });
  });

  test('truncates the title to eBay 80 character limit', () => {
    const row = deriveEbayRow({ ...listing, listing_title: 'A'.repeat(200) });
    expect(row.title).toHaveLength(MAX_EBAY_TITLE);
  });

  test('routes a pedal to the effects category', () => {
    expect(deriveEbayRow({ ...listing, listing_title: 'Boss DS-1 Distortion Pedal' }).categoryId).toBe('181222');
  });

  test('routes an amp head to guitar amplifiers', () => {
    expect(deriveEbayRow({ ...listing, listing_title: 'Marshall JCM800 Amp Head' }).categoryId).toBe('38072');
  });

  test('keeps HTML in the description and appends the return policy', () => {
    const row = deriveEbayRow(listing);
    expect(row.description).toContain('<p>Excellent player.</p>');
    expect(row.description).toContain('15% restocking fee');
  });

  test('caps photos at the eBay limit', () => {
    const many = Array.from({ length: 40 }, (_, i) => `https://example.com/${i}.jpg`);
    expect(deriveEbayRow({ ...listing, images: many }).images).toHaveLength(MAX_EBAY_PHOTOS);
  });
});

describe('buildDraftCsv', () => {
  const csv = buildDraftCsv([deriveEbayRow(listing)]);
  const rows = parseCsv(csv);

  test('preserves the template info rows verbatim', () => {
    for (let i = 0; i < DRAFT_INFO_ROWS.length; i++) {
      expect(rows[i][0]).toBe(DRAFT_INFO_ROWS[i][0]);
    }
  });

  test('preserves the Action header with its embedded site metadata', () => {
    const header = rows[DRAFT_INFO_ROWS.length];
    expect(header[0]).toBe('Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8)');
    expect(header).toEqual([...DRAFT_COLUMNS]);
  });

  test('drops the sample shoe row that ships with the template', () => {
    expect(csv).not.toContain('Test Draft Shoe');
    expect(csv).not.toContain('47140');
  });

  test('sets every row action to Draft', () => {
    const data = rows[DRAFT_INFO_ROWS.length + 1];
    expect(data[0]).toBe('Draft');
  });

  test('writes the derived values into their columns', () => {
    const header = rows[DRAFT_INFO_ROWS.length];
    const data = rows[DRAFT_INFO_ROWS.length + 1];
    const at = (col: string) => data[header.indexOf(col)];

    expect(at('Category ID')).toBe('33034');
    expect(at('Title')).toBe('2019 Fender American Professional Stratocaster');
    expect(at('Price')).toBe('1500');
    expect(at('Quantity')).toBe('1');
    expect(at('Condition ID')).toBe('USED_EXCELLENT');
    expect(at('Format')).toBe('FixedPrice');
    expect(at('Custom label (SKU)')).toBe('abc123');
  });

  test('joins multiple photo urls with a pipe in the single photo column', () => {
    const header = rows[DRAFT_INFO_ROWS.length];
    const data = rows[DRAFT_INFO_ROWS.length + 1];
    expect(data[header.indexOf('Item photo URL')]).toBe('https://example.com/1.jpg|https://example.com/2.jpg');
  });

  test('emits one data row per listing', () => {
    const two = buildDraftCsv([deriveEbayRow(listing), deriveEbayRow({ ...listing, id: 'b' })]);
    expect(parseCsv(two)).toHaveLength(DRAFT_INFO_ROWS.length + 3);
  });

  test('every emitted category id is one eBay actually has', () => {
    const known = new Set(EBAY_CATEGORIES.map(c => c.id));
    const header = rows[DRAFT_INFO_ROWS.length];
    const data = rows[DRAFT_INFO_ROWS.length + 1];
    expect(known).toContain(data[header.indexOf('Category ID')]);
  });
});
