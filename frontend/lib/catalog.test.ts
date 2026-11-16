import { describe, expect, it } from 'vitest';
import {
  coverImages,
  groupByBrand,
  priceBands,
  priceStats,
  isIndexableBrand,
  isInstrument,
  similarListings,
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

describe('price summaries', () => {
  const priced = (title: string, price: number, image?: string): CatalogListing => ({
    ...listing(title),
    price,
    images: image ? [image] : [],
  });
  const sold = [
    priced('Gibson SG', 900, 'sg.jpg'),
    priced('Gibson Les Paul', 2400),
    priced('Gibson ES-335', 3200, '335.jpg'),
    priced('Gibson Explorer', 1300, 'explorer.jpg'),
  ];

  it('finds the range and the median', () => {
    expect(priceStats(sold)).toEqual({ low: 900, high: 3200, median: 1850 });
    expect(priceStats(sold.slice(0, 3))).toEqual({ low: 900, high: 3200, median: 2400 });
    expect(priceStats([])).toBeNull();
  });

  it('counts sales into fixed bands, edges going to the higher band', () => {
    expect(priceBands([...sold, priced('Gibson Junior', 750)]).map((band) => band.count)).toEqual([
      0, 2, 1, 1, 1,
    ]);
  });

  it('collects lead photos, skipping listings without one', () => {
    expect(coverImages(sold, 2)).toEqual(['sg.jpg', '335.jpg']);
    expect(coverImages(sold, 9)).toEqual(['sg.jpg', '335.jpg', 'explorer.jpg']);
  });

  it('groups listings by maker', () => {
    const groups = groupByBrand([...sold, priced('PRS SE', 500), priced('No name', 100)]);
    expect([...groups.keys()]).toEqual(['Gibson', 'PRS']);
    expect(groups.get('Gibson')).toHaveLength(4);
  });
});

describe('isInstrument', () => {
  const item = (listing_title: string, price: number) => ({ listing_title, price });

  it('drops cheap parts and cases', () => {
    expect(isInstrument(item('Gibson Les Paul Wiring Harness', 50))).toBe(false);
    expect(isInstrument(item('PRS Multi-Fit Hard Guitar Case 2010s - Black Tolex', 160))).toBe(false);
    expect(isInstrument(item('Kiesel Beryllium 7 String Pickups - Pink & White', 80))).toBe(false);
  });

  it('keeps guitars, however cheap or however they mention a case', () => {
    expect(isInstrument(item('Washburn S1TS Sonamaster 2010s - Tobacco Sunburst', 149))).toBe(true);
    expect(isInstrument(item('Gibson SG Standard 2007 - Heritage Cherry with Hard Case', 1299))).toBe(true);
    expect(isInstrument(item('Epiphone Les Paul with Floyd Rose Bridge', 475))).toBe(true);
  });
});

describe('similarListings', () => {
  const guitar = (id: string, listing_title: string, price: number) =>
    ({ id, listing_title, price }) as CatalogListing;
  const active = [
    guitar('a', 'Ibanez RG550 1991 - Road Flare Red', 1150),
    guitar('b', 'Fender Player Stratocaster 2019 - Sunburst', 600),
    guitar('c', 'Fender American Ultra Telecaster 2021 Arctic Pearl', 1200),
    guitar('d', 'Gibson Les Paul Standard 2016 - Honeyburst', 2400),
  ];

  it('puts the same maker first, then the closest price, and leaves the guitar itself out', () => {
    const out = similarListings(active[2], active, 3);
    expect(out.map((listing) => listing.id)).toEqual(['b', 'a', 'd']);
  });

  it('falls back to price alone when the maker is unknown', () => {
    const out = similarListings(guitar('z', 'Handmade partscaster', 2000), active, 2);
    expect(out.map((listing) => listing.id)).toEqual(['d', 'c']);
  });
});
