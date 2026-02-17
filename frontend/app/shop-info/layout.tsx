import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Shop Info | Luke's Guitar Shop",
  description: "Learn more about Luke's Guitar Shop - quality pre-owned guitars since 2022. View our return policy and shop info.",
};

export default function ShopInfoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
