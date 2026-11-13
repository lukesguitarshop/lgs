import Link from 'next/link';
import { ReturnPolicy } from '@/components/ReturnPolicy';

export const metadata = {
  title: 'Return policy',
  description:
    "Luke's Guitar Shop return policy: returns by approval, requested within 24 hours of delivery, 15% restocking fee, buyer-paid insured return shipping.",
  alternates: { canonical: '/return-policy' },
  openGraph: { url: '/return-policy' },
};

/**
 * The return policy at its own address, rendered on the server. This is the URL
 * given to Google Merchant Center, which needs to read the policy in the page HTML.
 */
export default function ReturnPolicyPage() {
  return (
    <div className="container mx-auto px-5 py-8 sm:px-4">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-heading mb-6 text-3xl text-primary sm:text-5xl">Return policy</h1>
        <ReturnPolicy />
        <p className="mt-10 text-foreground/70">
          Shipping details and customer reviews are on the{' '}
          <Link href="/shop-info" className="underline hover:text-primary">
            shop info
          </Link>{' '}
          page.
        </p>
      </div>
    </div>
  );
}
