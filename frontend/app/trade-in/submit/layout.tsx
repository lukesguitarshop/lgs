import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Start a trade-in',
  description: 'Send photos of your guitar and get a cash or store-credit quote within 24 hours.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
