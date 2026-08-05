import { describe, expect, test } from 'vitest';
import {
  deriveBrand,
  deriveCategory,
  deriveYear,
  decadeForYear,
  mapCondition,
  buildDescription,
  netPayout,
  deriveRow,
  SWEETWATER_FEES,
} from './derive';
import { SUBCATEGORIES, TOP_CATEGORIES } from './vocabulary';

describe('deriveBrand', () => {
  test('finds a brand at the start of the title', () => {
    expect(deriveBrand('Fender American Vintage II 1961 Stratocaster')).toBe('Fender');
  });

  test('finds a brand later in the title', () => {
    expect(deriveBrand('2019 Gibson Les Paul Standard')).toBe('Gibson');
  });

  test('prefers the longest matching brand so multi-word names win', () => {
    expect(deriveBrand('Ernie Ball Music Man StingRay Bass')).toBe('Ernie Ball Music Man');
  });

  test('prefers the earliest brand when a longer brand name appears later as a colour or model word', () => {
    // "Heritage" is a real brand and longer than "Gibson", but it shows up here
    // as part of the finish name.
    expect(deriveBrand('2019 Gibson Les Paul Standard 50s Heritage Cherry Sunburst')).toBe('Gibson');
  });

  test('matches case-insensitively', () => {
    expect(deriveBrand('vintage FENDER telecaster')).toBe('Fender');
  });

  test('does not match a brand embedded inside a larger word', () => {
    expect(deriveBrand('Prsonal custom build')).toBeNull();
  });

  test('returns null when no known brand appears', () => {
    expect(deriveBrand('Handmade partscaster with no branding')).toBeNull();
  });
});

describe('deriveCategory', () => {
  const cases: [string, string, string][] = [
    ['Fender American Vintage II 1961 Stratocaster', 'guitars', 'solidbody-guitars'],
    ['Gibson ES-335 Semi-Hollow', 'guitars', 'semi-hollow-guitars'],
    ['Martin D-28 Acoustic Guitar', 'guitars', '6-string-guitars'],
    ['Fender Precision Bass 4-string', 'bass-gear', '4-string-bass-guitars'],
    ['Fender Twin Reverb Combo Amp', 'amplifiers', 'guitar-combo-amps'],
    ['Marshall JCM800 Amp Head', 'amplifiers', 'guitar-amp-heads'],
    ['Ibanez Tube Screamer Overdrive Pedal', 'effects-and-pedals', 'distortion-overdrive-boost-and-fuzz'],
    ['Boss DD-8 Digital Delay Pedal', 'effects-and-pedals', 'reverb-and-delay-pedals'],
  ];

  test.each(cases)('maps %s', (title, top, sub) => {
    expect(deriveCategory(title)).toEqual({ top, sub, guessed: false });
  });

  test('falls back to solidbody guitar and marks the result as a guess', () => {
    expect(deriveCategory('Mystery item nobody can classify')).toEqual({
      top: 'guitars',
      sub: 'solidbody-guitars',
      guessed: true,
    });
  });

  test('every rule produces a code that exists in the real Sweetwater vocabulary', () => {
    const topCodes = new Set(TOP_CATEGORIES.map(t => t.code));
    const subCodes = new Set(SUBCATEGORIES.map(s => s.code));

    for (const [title] of cases) {
      const { top, sub } = deriveCategory(title);
      expect(topCodes, `top code for "${title}"`).toContain(top);
      expect(subCodes, `sub code for "${title}"`).toContain(sub);
      expect(SUBCATEGORIES.find(s => s.code === sub)?.top).toBe(top);
    }
  });
});

describe('deriveYear', () => {
  test('pulls a four digit year out of the title', () => {
    expect(deriveYear('2019 Gibson Les Paul Standard')).toBe('2019');
  });

  test('pulls a vintage year', () => {
    expect(deriveYear('Fender American Vintage II 1961 Stratocaster')).toBe('1961');
  });

  test('ignores numbers outside a plausible year range', () => {
    expect(deriveYear('Boss DD-500 Digital Delay')).toBeNull();
  });

  test('returns null when the title carries no year', () => {
    expect(deriveYear('Gibson Les Paul Standard')).toBeNull();
  });
});

describe('decadeForYear', () => {
  test.each([
    ['1961', '1960s'],
    ['1969', '1960s'],
    ['2020', '2020s'],
    ['1899', 'pre 1900s'],
  ])('maps %s to %s', (year, decade) => {
    expect(decadeForYear(year)).toBe(decade);
  });

  test('returns empty string for an unparseable year', () => {
    expect(decadeForYear(null)).toBe('');
  });
});

describe('mapCondition', () => {
  test.each([
    ['Brand New', 'Mint'],
    ['Mint', 'Mint'],
    ['Excellent', 'Excellent'],
    ['Very Good', 'Good'],
    ['Good', 'Good'],
    ['Fair', 'Fair'],
    ['Poor', 'Poor'],
  ])('maps site condition %s to Sweetwater %s', (site, sweetwater) => {
    expect(mapCondition(site).value).toBe(sweetwater);
  });

  test('falls back to Excellent and flags the guess when condition is missing', () => {
    expect(mapCondition(null)).toEqual({ value: 'Excellent', guessed: true });
  });

  test('does not flag a guess when the condition maps cleanly', () => {
    expect(mapCondition('Very Good').guessed).toBe(false);
  });
});

describe('buildDescription', () => {
  test('converts HTML to plain text', () => {
    const result = buildDescription('<p>Great guitar.</p><p>Plays well.</p>');
    expect(result).toContain('Great guitar.');
    expect(result).toContain('Plays well.');
    expect(result).not.toContain('<p>');
  });

  test('strips the existing return policy block before appending the new one', () => {
    const result = buildDescription('<p>Nice.</p><b>Return Policy:</b> old policy text here');
    expect(result).not.toContain('old policy text');
  });

  test('appends the return policy', () => {
    expect(buildDescription('<p>Nice.</p>')).toContain('Return Policy');
    expect(buildDescription('<p>Nice.</p>')).toContain('15% restocking fee');
  });

  test('still emits the return policy when the description is empty', () => {
    expect(buildDescription(null)).toContain('Return Policy');
  });

  test('does not carry over the Facebook boilerplate', () => {
    const result = buildDescription('<p>Nice.</p>');
    expect(result).not.toContain('lukesguitarshop.com');
    expect(result).not.toContain('Columbus, Ohio');
  });
});

describe('netPayout', () => {
  test('withholds 7.5 percent for a cash payout', () => {
    expect(netPayout(1000, 'cash')).toBeCloseTo(925, 2);
  });

  test('withholds nothing for a store credit payout', () => {
    expect(netPayout(1000, 'store_credit')).toBe(1000);
  });

  test('exposes the fee split Sweetwater documents', () => {
    expect(SWEETWATER_FEES.sellerFeePercent + SWEETWATER_FEES.transactionFeePercent).toBeCloseTo(7.5, 5);
  });
});

describe('deriveRow', () => {
  const listing = {
    id: 'abc123',
    listing_title: '2019 Fender American Professional Stratocaster',
    description: '<p>Excellent player.</p>',
    condition: 'Excellent',
    price: 1500,
    images: ['https://rvb-img.reverb.com/image/upload/a_exif,w=640,h=480/a.jpg'],
  };

  test('fills every derivable column', () => {
    const row = deriveRow(listing);
    expect(row).toMatchObject({
      id: 'abc123',
      title: '2019 Fender American Professional Stratocaster',
      brand: 'Fender',
      topCategory: 'guitars',
      subCategory: 'solidbody-guitars',
      condition: 'Excellent',
      year: '2019',
      decade: '2010s',
      price: 1500,
    });
  });

  test('truncates titles to the 150 character bulk upload limit', () => {
    const row = deriveRow({ ...listing, listing_title: 'A'.repeat(200) });
    expect(row.title).toHaveLength(150);
  });

  test('keeps at most 25 images', () => {
    const many = Array.from({ length: 40 }, (_, i) => `https://example.com/${i}.jpg`);
    expect(deriveRow({ ...listing, images: many }).images).toHaveLength(25);
  });

  test('strips Reverb resize parameters so full resolution images are exported', () => {
    expect(deriveRow(listing).images[0]).toBe('https://rvb-img.reverb.com/image/upload/a.jpg');
  });

  test('leaves non-Reverb image urls untouched', () => {
    const row = deriveRow({ ...listing, images: ['https://example.com/photo.jpg'] });
    expect(row.images[0]).toBe('https://example.com/photo.jpg');
  });

  test('flags a row for review when the category had to be guessed', () => {
    expect(deriveRow({ ...listing, listing_title: 'Unclassifiable thing' }).needsReview).toBe(true);
  });

  test('does not flag a row when everything resolved confidently', () => {
    expect(deriveRow(listing).needsReview).toBe(false);
  });
});
