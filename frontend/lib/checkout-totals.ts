/**
 * What the checkout page shows before paying. Mirrors CheckoutTotals.Compute on the
 * API, which is the figure that is actually charged: item prices, then the discount
 * code, then store credit, then the PayPal fee on whatever is left.
 */

export const PAYPAL_FEE_RATE = 0.035;

export interface CheckoutTotalsInput {
  subtotal: number;
  /** What the applied discount code takes off, as quoted by the API. */
  discount: number;
  /** Store credit the buyer chose to apply; pass 0 when they did not. */
  creditBalance: number;
  payPal: boolean;
}

export interface CheckoutTotals {
  subtotal: number;
  discount: number;
  creditApplied: number;
  fee: number;
  amountDue: number;
}

const toCents = (amount: number) => Math.round(amount * 100);

export function computeCheckoutTotals({
  subtotal,
  discount,
  creditBalance,
  payPal,
}: CheckoutTotalsInput): CheckoutTotals {
  // Whole cents throughout, so the rounding matches the API instead of drifting on floats.
  const subtotalCents = toCents(subtotal);
  const discountCents = Math.min(Math.max(toCents(discount), 0), subtotalCents);
  const afterDiscount = subtotalCents - discountCents;

  const creditCents = Math.min(Math.max(toCents(creditBalance), 0), afterDiscount);
  const afterCredit = afterDiscount - creditCents;

  const feeCents = payPal ? Math.round(afterCredit * PAYPAL_FEE_RATE) : 0;

  return {
    subtotal: subtotalCents / 100,
    discount: discountCents / 100,
    creditApplied: creditCents / 100,
    fee: feeCents / 100,
    amountDue: (afterCredit + feeCents) / 100,
  };
}
