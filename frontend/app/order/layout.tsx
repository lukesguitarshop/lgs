import { Metadata } from 'next';

// The order page is a client component and cannot export metadata itself. Bare title;
// the root layout's template appends the shop name.
export const metadata: Metadata = {
  title: 'Order',
};

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
