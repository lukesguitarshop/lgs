import { describe, expect, it } from 'vitest';
import { countryCode, estimatedDeliveryDate } from '../components/checkout/GoogleCustomerReviews';

describe('countryCode', () => {
  it('passes a two-letter code through in capitals', () => {
    expect(countryCode('us')).toBe('US');
    expect(countryCode(' CA ')).toBe('CA');
  });

  it('knows the ways people write the United States', () => {
    expect(countryCode('United States')).toBe('US');
    expect(countryCode('USA')).toBe('US');
  });

  it('gives nothing rather than guessing', () => {
    expect(countryCode('Germany')).toBeNull();
    expect(countryCode(undefined)).toBeNull();
  });
});

describe('estimatedDeliveryDate', () => {
  it('is a plain date some days after the order, across a month end', () => {
    expect(estimatedDeliveryDate(new Date('2026-11-28T15:00:00Z'), 6)).toBe('2026-12-04');
  });
});
