import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "About | Luke's Guitar Shop",
  description: "Learn more about Luke's Guitar Shop - quality pre-owned guitars since 2022. View our return policy and shop info.",
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
