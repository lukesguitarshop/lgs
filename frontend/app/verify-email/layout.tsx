import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verify your email',
  description: "Confirm your email address for your Luke's Guitar Shop account.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
