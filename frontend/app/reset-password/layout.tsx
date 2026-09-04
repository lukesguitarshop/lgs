import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset your password',
  description: "Reset the password on your Luke's Guitar Shop account.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
