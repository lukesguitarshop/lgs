import { describe, expect, test } from 'vitest';
import {
  LISTING_DEFAULTS,
  buildListingCsv,
  conditionIdFor,
  deriveAmplifierType,
  deriveBodyColor,
  deriveBodyType,
  deriveHandedness,
  deriveListingRow,
  deriveStringConfiguration,
  deriveType,
  truncateTitle,
  MAX_EBAY_TITLE,
} from './listing';
import { CATEGORY_ASPECTS, EBAY_COLUMNS } from './template';

const base = {
  id: 'lg-1',
  listing_title: '2019 Fender American Professional Stratocaster Olympic White',
  description: '<p>Great player.</p>',
  condition: 'Excellent',
  price: 1500,
  images: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
};

function parseCsv(input: string): string[][] {
  const rows: string[][] = [[]];
  let field = '';
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"') { if (input[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { rows[rows.length - 1].push(field); field = ''; }
    else if (c === '\r' && input[i + 1] === '\n') { rows[rows.length - 1].push(field); field = ''; rows.push([]); i++; }
    else field += c;
  }
  rows[rows.length - 1].push(field);
  return rows;
}

describe('truncateTitle', () => {
  test('leaves a short title alone', () => {
    expect(truncateTitle('Fender Stratocaster')).toBe('Fender Stratocaster');
  });

  test('cuts at a word boundary rather than mid-word', () => {
    const title = 'Fender American Professional II Stratocaster Olympic White Rosewood Fingerboard';
    const result = truncateTitle(title);
    expect(result.length).toBeLessThanOrEqual(MAX_EBAY_TITLE);
    expect(title.startsWith(result)).toBe(true);
    expect(result.endsWith(' ')).toBe(false);
    // The previous version cut mid-word at exactly 80; this must not.
    expect(title[result.length] === ' ' || result.length === title.length).toBe(true);
  });

  test('falls back to a hard cut when a single word exceeds the limit', () => {
    expect(truncateTitle('A'.repeat(120))).toHaveLength(MAX_EBAY_TITLE);
  });
});

describe('conditionIdFor', () => {
  test.each([
    ['Brand New', '1000'],
    ['Mint', '3000'],
    ['Excellent', '3000'],
    ['Very Good', '3000'],
    ['Good', '3000'],
    ['Fair', '3000'],
    ['Poor', '7000'],
  ])('maps %s to numeric ConditionID %s', (site, id) => {
    expect(conditionIdFor(site)).toBe(id);
  });

  test('defaults to used', () => {
    expect(conditionIdFor(null)).toBe('3000');
  });
});

describe('deriveType', () => {
  test.each([
    ['33034', 'Electric Guitar'],
    ['33021', 'Acoustic Guitar'],
    ['22966', 'Acoustic-Electric Guitar'],
  ])('category %s has a single valid type %s', (cat, expected) => {
    expect(deriveType(cat, 'anything')).toBe(expected);
  });

  test('picks the bass type from the title', () => {
    expect(deriveType('4713', 'Fender Precision Bass')).toBe('Electric Bass Guitar');
    expect(deriveType('4713', 'Guild Acoustic Bass Guitar')).toBe('Acoustic Bass Guitar');
  });

  test('every derived type is one eBay accepts for that category', () => {
    for (const cat of ['33034', '33021', '22966', '4713']) {
      const allowed = CATEGORY_ASPECTS[cat].values['Type'];
      expect(allowed, `category ${cat}`).toContain(deriveType(cat, 'Fender Bass'));
    }
  });
});

describe('deriveBodyType', () => {
  test('defaults an electric guitar to Solid', () => {
    expect(deriveBodyType('33034', 'Fender Stratocaster')).toBe('Solid');
  });

  test('detects a semi-hollow', () => {
    expect(deriveBodyType('33034', 'Gibson ES-335 Semi-Hollow')).toBe('Semi-Hollow');
  });

  test('detects a hollowbody', () => {
    expect(deriveBodyType('33034', 'Gretsch Hollowbody Archtop')).toBe('Hollow');
  });

  test('defaults an acoustic to Dreadnought', () => {
    expect(deriveBodyType('33021', 'Martin D-28')).toBe('Dreadnought');
  });

  test('only ever returns a value valid for its category', () => {
    for (const cat of ['33034', '33021', '22966', '4713']) {
      const allowed = CATEGORY_ASPECTS[cat].values['Body Type'];
      for (const title of ['Strat', 'ES-335 semi-hollow', 'hollowbody archtop', 'D-28']) {
        expect(allowed, `${cat} / ${title}`).toContain(deriveBodyType(cat, title));
      }
    }
  });
});

describe('deriveStringConfiguration', () => {
  test('defaults to 6 String', () => {
    expect(deriveStringConfiguration('Fender Stratocaster', '33034')).toBe('6 String');
  });

  test('detects a 12 string', () => {
    expect(deriveStringConfiguration('Rickenbacker 360 12-String', '33034')).toBe('12 String');
  });

  test('defaults a bass to 4 String', () => {
    expect(deriveStringConfiguration('Fender Precision Bass', '4713')).toBe('4 String');
  });

  test('detects a 5 string bass', () => {
    expect(deriveStringConfiguration('Fender Jazz Bass V 5-string', '4713')).toBe('5 String');
  });
});

describe('deriveHandedness', () => {
  test('defaults to right handed', () => {
    expect(deriveHandedness('Fender Stratocaster')).toBe('Right-Handed');
  });

  test.each(['Fender Stratocaster Left-Handed', 'Gibson Les Paul lefty', 'Martin D-28 LH'])(
    'detects left handed in %s',
    title => {
      expect(deriveHandedness(title)).toBe('Left-Handed');
    },
  );
});

describe('deriveBodyColor', () => {
  test.each([
    ['Fender Stratocaster Olympic White', 'White'],
    ['Fender Stratocaster Fiesta Red', 'Red'],
    ['Gibson Les Paul Heritage Cherry Sunburst', 'Brown'],
    ['Gibson Les Paul Goldtop', 'Gold'],
    ['Fender Telecaster Lake Placid Blue', 'Blue'],
    ['Gibson SG Ebony', 'Black'],
    ['Fender Telecaster Butterscotch Blonde', 'Beige'],
  ])('maps the finish in %s to %s', (title, expected) => {
    expect(deriveBodyColor(title)).toBe(expected);
  });

  test('returns empty when no colour is named', () => {
    expect(deriveBodyColor('Fender Stratocaster')).toBe('');
  });

  test('only returns colours eBay accepts', () => {
    const allowed = CATEGORY_ASPECTS['33034'].values['Body Color'];
    for (const title of ['Olympic White', 'Fiesta Red', 'Sunburst', 'Goldtop', 'Sonic Blue']) {
      const colour = deriveBodyColor(title);
      if (colour) expect(allowed, title).toContain(colour);
    }
  });
});

describe('deriveAmplifierType', () => {
  test.each([
    ['Marshall JCM800 Amp Head', 'Head'],
    ['Fender Twin Reverb Combo', 'Combo'],
    ['Marshall 1960A 4x12 Cabinet', 'Cabinet'],
    ['Marshall Full Stack', 'Stack'],
  ])('maps %s to %s', (title, expected) => {
    expect(deriveAmplifierType(title)).toBe(expected);
  });

  test('defaults to Combo, the most common used amp', () => {
    expect(deriveAmplifierType('Vox AC30')).toBe('Combo');
  });
});

describe('deriveListingRow', () => {
  test('fills the required aspects for an electric guitar', () => {
    expect(deriveListingRow(base)).toMatchObject({
      categoryId: '33034',
      brand: 'Fender',
      type: 'Electric Guitar',
      conditionId: '3000',
      bodyType: 'Solid',
      stringConfiguration: '6 String',
      handedness: 'Right-Handed',
      bodyColor: 'White',
    });
  });

  test('falls back to Unbranded rather than leaving the required Brand empty', () => {
    const row = deriveListingRow({ ...base, listing_title: 'Handmade partscaster' });
    expect(row.brand).toBe('Unbranded');
    expect(row.needsReview).toBe(true);
  });

  test('sets the amplifier type when the row is an amp', () => {
    const row = deriveListingRow({ ...base, listing_title: 'Marshall JCM800 Amp Head' });
    expect(row.categoryId).toBe('38072');
    expect(row.amplifierType).toBe('Head');
  });

  test('leaves amplifier type empty for a guitar', () => {
    expect(deriveListingRow(base).amplifierType).toBe('');
  });

  test.each([
    // eBay rejected a Kiesel gig bag listed under Electric Guitars.
    ['Kiesel Gig Bag Soft Case', '41408'],
    ['Fender Stratocaster Hardshell Case', '41408'],
    ['Seymour Duncan JB Humbucker Pickup', '22670'],
    ['Gibson Les Paul Pickguard', '41424'],
    ['Ernie Ball Guitar Strap', '46677'],
    ['Temple Audio Pedalboard', '181222'],
    ['Kyser Quick-Change Capo', '33050'],
  ])('routes the accessory %s out of the instrument categories', (title, categoryId) => {
    expect(deriveListingRow({ ...base, listing_title: title }).categoryId).toBe(categoryId);
  });

  test('still treats a slide guitar as an instrument, not a slide', () => {
    expect(deriveListingRow({ ...base, listing_title: 'Gretsch slide guitar resonator' }).categoryId).not.toBe('7266');
  });

  test('flags an accessory row for review, since the template carries no aspects for it', () => {
    expect(deriveListingRow({ ...base, listing_title: 'Kiesel Gig Bag Soft Case' }).needsReview).toBe(true);
  });

  test('omits guitar-only aspects on an amp, which does not define them', () => {
    const amp = deriveListingRow({ ...base, listing_title: 'Marshall JCM800 Amp Head' });
    expect(amp.stringConfiguration).toBe('');
    expect(amp.handedness).toBe('');
    expect(amp.bodyColor).toBe('');
    expect(amp.type).toBe('');
  });

  test('never emits an aspect value the category does not publish', () => {
    for (const title of ['Fender Stratocaster', 'Marshall JCM800 Amp Head', 'Martin D-28 Acoustic', 'Fender Jazz Bass']) {
      const row = deriveListingRow({ ...base, listing_title: title });
      const values = CATEGORY_ASPECTS[row.categoryId]?.values ?? {};
      const checks: [string, string][] = [
        ['Type', row.type],
        ['Body Type', row.bodyType],
        ['String Configuration', row.stringConfiguration],
        ['Handedness', row.handedness],
        ['Body Color', row.bodyColor],
        ['Amplifier Type', row.amplifierType],
      ];
      for (const [aspect, value] of checks) {
        if (value) expect(values[aspect] ?? [], `${title} / ${aspect}`).toContain(value);
      }
    }
  });
});

describe('buildListingCsv', () => {
  const csv = buildListingCsv([deriveListingRow(base)]);
  const rows = parseCsv(csv);
  const header = rows[1];
  const data = rows[2];
  const at = (col: string) => data[header.indexOf(col)];

  test('keeps the eBay version line and column header verbatim', () => {
    expect(rows[0][0]).toBe('Info');
    expect(rows[0][1]).toBe('Version=1.0.0');
    expect(header).toEqual([...EBAY_COLUMNS]);
  });

  test('drops the guidance rows that only document the template', () => {
    expect(csv).not.toContain('>>> The recommended value');
    expect(csv).not.toContain('>>> For categoryId');
  });

  test('emits one data row per listing and nothing more', () => {
    expect(rows).toHaveLength(3);
  });

  test('writes every required column', () => {
    // eBay rejects "Draft" in this template; VerifyAdd is the safe dry run.
    expect(at('*Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8)')).toBe('VerifyAdd');
    expect(at('*Category')).toBe('33034');
    expect(at('*Title')).toBe(base.listing_title);
    expect(at('*ConditionID')).toBe('3000');
    expect(at('*C:Brand')).toBe('Fender');
    expect(at('*C:Type')).toBe('Electric Guitar');
    expect(at('*Format')).toBe('FixedPrice');
    expect(at('*Duration')).toBe('GTC');
    expect(at('*StartPrice')).toBe('1500');
    expect(at('*Quantity')).toBe('1');
    expect(at('*Location')).toBe(LISTING_DEFAULTS.location);
  });

  test('turns offers on', () => {
    expect(at('BestOfferEnabled')).toBe('1');
  });

  test('does not require immediate payment, which eBay warns conflicts with offers', () => {
    expect(at('ImmediatePayRequired')).toBe('0');
  });

  test('sets free shipping paid by the seller', () => {
    expect(at('ShippingType')).toBe('Flat');
    expect(at('ShippingService-1:Cost')).toBe('0');
    expect(at('ShippingService-1:Option')).toBe(LISTING_DEFAULTS.shippingService);
  });

  test('pipes multiple photos into PicURL', () => {
    expect(at('PicURL')).toBe('https://example.com/a.jpg|https://example.com/b.jpg');
  });

  test('keeps HTML in the description and appends the return policy', () => {
    expect(at('*Description')).toContain('<p>Great player.</p>');
    expect(at('*Description')).toContain('15% restocking fee');
  });

  test('never emits Draft, which this template rejects', () => {
    expect(csv).not.toContain('Draft');
  });

  test('honours an Add action when the seller wants listings live', () => {
    const live = buildListingCsv([deriveListingRow(base)], { action: 'Add' });
    const cells = parseCsv(live)[2];
    expect(cells[0]).toBe('Add');
  });

  test('every row carries all 97 columns', () => {
    expect(header).toHaveLength(97);
    expect(data).toHaveLength(97);
  });

  test('leaves the amplifier aspect blank for a guitar so eBay does not reject it', () => {
    expect(at('*C:Amplifier Type')).toBe('');
  });
});
