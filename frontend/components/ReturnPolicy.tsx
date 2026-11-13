/**
 * The shop's payment and return terms. One copy, shown in two places: the Returns tab
 * on Shop Info, and /return-policy.
 *
 * /return-policy exists because the tab is switched in the browser, so its text is
 * not in the HTML a crawler receives. Google Merchant Center reviews the return
 * policy by fetching the policy URL, found nothing there, and rejected the policy.
 * Keep this a server-renderable component (no hooks, no 'use client').
 */
export function ReturnPolicy() {
  return (
    <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-2">Payment</h2>
        <p className="text-foreground/80">Item is not reserved or considered sold until payment has fully cleared. Pending or unverified payments do not hold the item.</p>
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-2">Pre-purchase Inspection</h2>
        <p className="text-foreground/80">All buyers are responsible for reviewing every photo and the full listing description before purchasing. Additional photos, measurements, or details are available on request — please ask before you buy, not after. Purchasing constitutes acknowledgment that you have reviewed the listing in full.</p>
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-2">All Sales Final</h2>
        <p className="text-foreground/80">Items are sold as-is. Cancellations are not accepted once payment has cleared. A 15% restocking fee applies to any cancelled order, regardless of shipping or tracking status, as preparation, packing, and handling begin immediately upon sale.</p>
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-2">Returns</h2>
        <p className="text-foreground/80 mb-3">Returns are by approval only and must be requested within 24 hours of delivery. Approved returns are subject to:</p>
        <ul className="space-y-2 text-foreground/80 list-none pl-0">
          <li className="flex items-start gap-3">
            <span className="text-primary font-bold mt-0.5">—</span>
            <span>A 15% restocking fee (non-negotiable)</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-primary font-bold mt-0.5">—</span>
            <span>Return in original condition with all original packaging and accessories</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-primary font-bold mt-0.5">—</span>
            <span>Buyer-paid return shipping with full insurance and signature confirmation</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-primary font-bold mt-0.5">—</span>
            <span>Refund issued only after the item is received and inspected</span>
          </li>
        </ul>
        <p className="text-foreground/80 mt-3">Items returned damaged, incomplete, or without insurance are not eligible for refund.</p>
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-2">Store Credit Purchases</h2>
        <p className="text-foreground/80">Guitars purchased using store credit are final sale and are not eligible for return under any circumstances. No exceptions will be made.</p>
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-2">Condition Expectations</h2>
        <p className="text-foreground/80">You are purchasing a used instrument, not a professionally set-up guitar. Minor adjustments (intonation, action, tuning stability, etc.) are expected and are the buyer&apos;s responsibility. &ldquo;Used&rdquo; condition is not grounds for a return.</p>
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-2">Communication</h2>
        <p className="text-foreground/80">Questions are welcome before purchase. Message me anytime — I&apos;d rather answer ten questions upfront than deal with a misunderstanding after the sale.</p>
      </div>
    </div>
  );
}
