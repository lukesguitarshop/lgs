import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Shop info",
  description: "Shipping, returns and customer reviews for Luke's Guitar Shop, a one-person used guitar shop in Ohio selling since 2022.",
  alternates: { canonical: '/shop-info' },
  openGraph: { url: '/shop-info' },
};

export default function ShopInfoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
