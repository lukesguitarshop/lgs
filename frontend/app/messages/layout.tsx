import { Metadata } from 'next';

// The messages list and the conversation thread are client pages, so the title lives
// here. Bare — the root layout's template appends the shop name.
export const metadata: Metadata = {
  title: 'Messages',
};

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
