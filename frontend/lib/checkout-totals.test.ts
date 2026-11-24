import { describe, expect, it } from 'vitest';
import { computeCheckoutTotals } from './checkout-totals';

describe('computeCheckoutTotals', () => {
  it('charges the subtotal on a card order with no code or credit', () => {
    expect(computeCheckoutTotals({ subtotal: 1200, discount: 0, creditBalance: 0, payPal: false })).toEqual({
      subtotal: 1200,
      discount: 0,
      creditApplied: 0,
      fee: 0,
      amountDue: 1200,
    });
  });

  it('takes the discount off before store credit', () => {
    const totals = computeCheckoutTotals({ subtotal: 1200, discount: 60, creditBalance: 5000, payPal: false });

    expect(totals.creditApplied).toBe(1140);
    expect(totals.amountDue).toBe(0);
  });

  it('charges the PayPal fee on what is left after discount and credit', () => {
    const totals = computeCheckoutTotals({ subtotal: 1200, discount: 60, creditBalance: 140, payPal: true });

    expect(totals.fee).toBe(35);
    expect(totals.amountDue).toBe(1035);
  });

  it('rounds the PayPal fee to the cent', () => {
    const totals = computeCheckoutTotals({ subtotal: 999.99, discount: 50, creditBalance: 0, payPal: true });

    expect(totals.fee).toBe(33.25);
    expect(totals.amountDue).toBe(983.24);
  });

  it('never lets the discount exceed the subtotal', () => {
    const totals = computeCheckoutTotals({ subtotal: 100, discount: 250, creditBalance: 0, payPal: false });

    expect(totals.discount).toBe(100);
    expect(totals.amountDue).toBe(0);
  });
});
