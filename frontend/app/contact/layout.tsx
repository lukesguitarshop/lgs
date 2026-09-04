import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Questions about a listing? Ask before you buy — typical reply under 4 hours.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
