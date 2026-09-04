import type { Metadata } from 'next';

// The checkout page is a client component and cannot export metadata itself. The title
// is bare; the root layout's template adds the shop suffix once. The success and cancel
// sub-routes inherit it.
export const metadata: Metadata = {
  title: 'Checkout',
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
