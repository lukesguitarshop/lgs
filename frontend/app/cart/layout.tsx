import type { Metadata } from 'next';

// The cart page is a client component and cannot export metadata itself. The title is
// bare; the root layout's template adds the shop suffix once.
export const metadata: Metadata = {
  title: 'Shopping cart',
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
