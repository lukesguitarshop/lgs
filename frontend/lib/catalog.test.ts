import { describe, expect, it } from 'vitest';
import {
  isIndexableBrand,
  listingsForBrand,
  summarizeBrands,
  type CatalogListing,
} from './catalog';

function listing(title: string): CatalogListing {
  return {
    id: title,
    listing_title: title,
    condition: 'Excellent',
    images: [],
    price: 1000,
    currency: 'USD',
    scraped_at: '2026-01-01T00:00:00Z',
  };
}

describe('summarizeBrands', () => {
  const active = [listing('Fender Stratocaster'), listing('PRS Silver Sky'), listing('PRS SE')];
  const sold = [
    listing('Gibson SG'),
    listing('Gibson Les Paul'),
    listing('Fender Telecaster'),
    listing('Unbranded kit'),
  ];

  it('counts stock and sold per brand, in-stock brands first', () => {
    expect(summarizeBrands(active, sold)).toEqual([
      { brand: 'PRS', inStock: 2, sold: 0 },
      { brand: 'Fender', inStock: 1, sold: 1 },
      { brand: 'Gibson', inStock: 0, sold: 2 },
    ]);
  });

  it('filters listings to one brand', () => {
    expect(listingsForBrand(sold, 'Gibson').map((l) => l.listing_title)).toEqual([
      'Gibson SG',
      'Gibson Les Paul',
    ]);
  });
});

describe('isIndexableBrand', () => {
  it('needs stock, or a real sold record', () => {
    expect(isIndexableBrand({ brand: 'PRS', inStock: 1, sold: 0 })).toBe(true);
    expect(isIndexableBrand({ brand: 'Gibson', inStock: 0, sold: 5 })).toBe(true);
    expect(isIndexableBrand({ brand: 'Tokai', inStock: 0, sold: 1 })).toBe(false);
  });
});
