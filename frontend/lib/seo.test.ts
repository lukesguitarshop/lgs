import { describe, expect, it } from 'vitest';
import {
  extractBrand,
  extractColor,
  feedCondition,
  htmlToText,
  isPurchasable,
  listingMetaDescription,
  productDescription,
  truncate,
} from './seo';

describe('extractBrand', () => {
  it('finds the maker in a title', () => {
    expect(extractBrand('PRS SE Standard 24 2019 - Translucent Blue')).toBe('PRS');
    expect(extractBrand("Gibson Les Paul Standard '60s 2022 - Sixties Cherry")).toBe('Gibson');
  });

  it('matches whole words only', () => {
    expect(extractBrand('Deanza Custom Shop Special')).toBeNull();
    expect(extractBrand('Kayak-shaped novelty guitar')).toBeNull();
  });

  it('prefers the maker named first', () => {
    expect(extractBrand('Squier by Fender Classic Vibe Telecaster')).toBe('Squier');
  });

  it('returns null rather than inventing a brand', () => {
    expect(extractBrand('Unbranded parts guitar')).toBeNull();
  });
});

describe('extractColor', () => {
  it('reads the finish after the last dash', () => {
    expect(extractColor('Fender Gold Foil Jazzmaster 2023 - Shoreline Gold')).toBe('Shoreline Gold');
  });

  it('returns null when the title has no finish', () => {
    expect(extractColor('Fender Stratocaster 1997')).toBeNull();
  });
});

describe('htmlToText', () => {
  it('keeps a space between paragraphs', () => {
    expect(htmlToText('<p>gig bag.</p><p>Payment</p>')).toBe('gig bag. Payment');
    expect(htmlToText('one<br><br>two')).toBe('one two');
  });

  it('decodes common entities', () => {
    expect(htmlToText('G&amp;L&nbsp;ASAT')).toBe('G&L ASAT');
  });
});

describe('productDescription', () => {
  it('drops the return policy boilerplate', () => {
    const html =
      '<p>2019 PRS in great shape. Comes with the gig bag.<br><br>Return Policy:</p><p>Payment</p><p>Item is not reserved…</p>';
    expect(productDescription(html)).toBe('2019 PRS in great shape. Comes with the gig bag.');
  });

  it('leaves a description without the boilerplate alone', () => {
    expect(productDescription('<p>Plain write-up.</p>')).toBe('Plain write-up.');
  });
});

describe('truncate', () => {
  it('cuts at a word boundary', () => {
    const out = truncate('The translucent finish lets the mahogany grain show', 30);
    expect(out.length).toBeLessThanOrEqual(30);
    expect(out).toBe('The translucent finish lets…');
  });

  it('leaves short text alone', () => {
    expect(truncate('short', 30)).toBe('short');
  });
});

describe('feedCondition', () => {
  it('treats graded used guitars as used', () => {
    for (const c of ['Mint', 'Excellent', 'Very Good', 'Good', 'Like New', null]) {
      expect(feedCondition(c)).toBe('used');
    }
  });

  it('only calls a guitar new when the condition says new', () => {
    expect(feedCondition('Brand New')).toBe('new');
    expect(feedCondition('B-Stock Refurbished')).toBe('refurbished');
  });
});

describe('isPurchasable', () => {
  it('is false for disabled or reserved listings', () => {
    expect(isPurchasable({})).toBe(true);
    expect(isPurchasable({ disabled: true })).toBe(false);
    expect(isPurchasable({ is_reserved: true })).toBe(false);
  });
});

describe('listingMetaDescription', () => {
  it('leads with condition, price and shipping, within Google’s length', () => {
    const out = listingMetaDescription({
      listing_title: 'PRS SE Standard 24 2019 - Translucent Blue',
      description:
        '<p>2019 PRS SE Standard 24 in Translucent Blue, in excellent condition with just some surface scratching and light player’s wear, and it’s all original.</p>',
      condition: 'Excellent',
      price: 549,
      currency: 'USD',
    });
    expect(out.startsWith('Excellent condition · $549 · Free insured shipping. 2019 PRS')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(158);
    expect(out.endsWith('…')).toBe(true);
  });
});
