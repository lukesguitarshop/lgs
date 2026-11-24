import { describe, expect, it } from 'vitest';
import type { CatalogListing } from './catalog';
import {
  extractModel,
  isIndexableModel,
  listingsForModel,
  modelFromSlug,
  modelPath,
  summarizeModels,
} from './models';

const guitar = (listing_title: string) => ({ listing_title }) as CatalogListing;

describe('extractModel', () => {
  it('finds the family wherever it sits in the title', () => {
    expect(extractModel("Gibson Les Paul Standard '60s 2022 - Sixties Cherry")).toEqual({
      brand: 'Gibson',
      model: 'Les Paul',
    });
    expect(extractModel('Gibson Adam Jones Signature Les Paul Standard')?.model).toBe('Les Paul');
    expect(extractModel('Fender Limited Edition American Professional Stratocaster 2020')?.model).toBe(
      'Stratocaster',
    );
    expect(extractModel('ESP LTD EC-1000 with Rosewood Fretboard 2006 - Black')?.model).toBe('Eclipse');
    expect(extractModel('PRS SE Custom 24 2019')?.model).toBe('Custom 24');
    expect(extractModel('PRS CE 24 Semi-Hollow 2020')?.model).toBe('CE 24');
  });

  it('keeps one maker from borrowing another maker\'s model', () => {
    expect(extractModel('Epiphone Adam Jones Les Paul Custom')).toEqual({
      brand: 'Epiphone',
      model: 'Les Paul',
    });
    expect(extractModel('Schecter Keith Merrow KM-7')).toBeNull();
  });

  it('does not invent a model from a series name', () => {
    expect(extractModel('Jackson Pro Series Signature Misha Mansoor Juggernaut')).toBeNull();
    expect(extractModel('Taylor Gold Label 517e 2025 - Blacktop')).toBeNull();
    expect(extractModel('Handmade partscaster')).toBeNull();
  });
});

describe('model addresses', () => {
  it('nests the model under its maker', () => {
    expect(modelPath('Gibson', 'Les Paul')).toBe('/guitars/gibson/les-paul');
    expect(modelPath('PRS', 'CE 24')).toBe('/guitars/prs/ce-24');
  });

  it('reads a model back from its address, for the right maker only', () => {
    expect(modelFromSlug('Gibson', 'les-paul')).toBe('Les Paul');
    expect(modelFromSlug('Fender', 'les-paul')).toBeNull();
    expect(modelFromSlug('Gibson', 'nope')).toBeNull();
  });
});

describe('summarizeModels', () => {
  const active = [guitar('Gibson SG Standard Dark 2021'), guitar('Taylor Gold Label 517e 2025')];
  const sold = [
    guitar('Gibson Les Paul Studio 2016'),
    guitar('Gibson Les Paul Classic 2019'),
    guitar('Gibson SG Standard 2023 - Ebony'),
  ];

  it('counts stock and sales per family, in-stock families first', () => {
    expect(summarizeModels(active, sold)).toEqual([
      { brand: 'Gibson', model: 'SG', inStock: 1, sold: 1 },
      { brand: 'Gibson', model: 'Les Paul', inStock: 0, sold: 2 },
    ]);
  });

  it('gives a page to a family in stock or with a real sold record', () => {
    expect(isIndexableModel({ brand: 'Gibson', model: 'SG', inStock: 1, sold: 0 })).toBe(true);
    expect(isIndexableModel({ brand: 'Gibson', model: 'Les Paul', inStock: 0, sold: 2 })).toBe(false);
    expect(isIndexableModel({ brand: 'Gibson', model: 'Les Paul', inStock: 0, sold: 5 })).toBe(true);
  });

  it('filters listings down to one family', () => {
    expect(listingsForModel(sold, 'Gibson', 'Les Paul')).toHaveLength(2);
  });
});
