import { describe, it, expect } from 'vitest';
import {
  currentStage,
  getStatusDisplay,
  getTrackingUrl,
  orderNumber,
  orderTimeline,
} from './orders';

describe('orderNumber', () => {
  it('shortens an order id to the code a customer can quote', () => {
    expect(orderNumber('68a1b2c3d4e5f60718293a4b')).toBe('18293A4B');
  });
});

describe('getTrackingUrl', () => {
  it('builds a carrier link regardless of how the carrier was cased', () => {
    expect(getTrackingUrl('ups', '1Z999')).toBe('https://www.ups.com/track?tracknum=1Z999');
    expect(getTrackingUrl('FedEx', '7777')).toBe('https://www.fedex.com/fedextrack/?trknbr=7777');
    expect(getTrackingUrl('USPS', '9400')).toBe(
      'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400'
    );
  });

  it('returns null for a carrier we have no link for', () => {
    expect(getTrackingUrl('DHL', '123')).toBeNull();
  });
});

describe('getStatusDisplay', () => {
  it('reads stored statuses back in plain English', () => {
    expect(getStatusDisplay('completed')).toBe('Payment Received');
    expect(getStatusDisplay('paid')).toBe('Payment Received');
    expect(getStatusDisplay('shipped')).toBe('Shipped');
    expect(getStatusDisplay('delivered')).toBe('Delivered');
  });

  it('passes anything unrecognised straight through', () => {
    expect(getStatusDisplay('refunded')).toBe('refunded');
  });
});

describe('currentStage', () => {
  it('treats an unpaid order as only placed', () => {
    expect(currentStage('pending')).toBe('placed');
  });

  it('maps both paid spellings to the same stage', () => {
    expect(currentStage('completed')).toBe('paid');
    expect(currentStage('paid')).toBe('paid');
  });

  it('follows the package once it moves', () => {
    expect(currentStage('shipped')).toBe('shipped');
    expect(currentStage('DELIVERED')).toBe('delivered');
  });
});

describe('orderTimeline', () => {
  it('marks every step up to the current one as done', () => {
    const steps = orderTimeline('shipped', true);
    expect(steps.map(s => s.done)).toEqual([true, true, true, false]);
    expect(steps.filter(s => s.current).map(s => s.stage)).toEqual(['shipped']);
  });

  it('completes the whole track once delivered', () => {
    expect(orderTimeline('delivered', true).every(s => s.done)).toBe(true);
  });

  it('only promises a tracking number when there is one', () => {
    const withTracking = orderTimeline('shipped', true).find(s => s.stage === 'shipped')!;
    const without = orderTimeline('shipped', false).find(s => s.stage === 'shipped')!;
    expect(withTracking.detail).toContain('tracking number');
    expect(without.detail).not.toContain('tracking number');
  });

  it('leaves every date blank when the order carries no timestamps', () => {
    expect(orderTimeline('shipped', true).every(s => s.date === null)).toBe(true);
  });

  it('dates the steps that have happened', () => {
    const steps = orderTimeline('delivered', true, {
      createdAt: '2026-03-01T12:00:00Z',
      shippedAt: '2026-03-02T12:00:00Z',
      deliveredAt: '2026-03-06T12:00:00Z',
    });
    const byStage = Object.fromEntries(steps.map(s => [s.stage, s.date]));
    expect(byStage.placed).toBe('March 1, 2026');
    expect(byStage.shipped).toBe('March 2, 2026');
    expect(byStage.delivered).toBe('March 6, 2026');
  });

  it('never dates a step the order has not reached', () => {
    // A delivery date can be recorded before the status catches up; showing it on an
    // unreached step would read as a promise rather than a fact.
    const steps = orderTimeline('shipped', true, {
      createdAt: '2026-03-01T12:00:00Z',
      shippedAt: '2026-03-02T12:00:00Z',
      deliveredAt: '2026-03-06T12:00:00Z',
    });
    expect(steps.find(s => s.stage === 'delivered')!.date).toBeNull();
  });

  it('falls back to no date when a stamp is missing', () => {
    const steps = orderTimeline('delivered', true, {
      createdAt: '2026-03-01T12:00:00Z',
      shippedAt: null,
      deliveredAt: null,
    });
    expect(steps.find(s => s.stage === 'shipped')!.date).toBeNull();
    expect(steps.find(s => s.stage === 'placed')!.date).toBe('March 1, 2026');
  });
});
