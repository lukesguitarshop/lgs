'use client';

import { usePathname } from 'next/navigation';

/**
 * The redesigned homepage runs full-bleed: its sections own their own max-width and
 * paint edge-to-edge bands behind the hero, the About block and the closing CTA. Every
 * other page still expects the centred container <main> used to provide, so the shell
 * keeps it for them rather than making seventeen pages grow their own wrapper.
 *
 * Children are passed through untouched, so server components stay server components.
 */
const FULL_BLEED_ROUTES = ['/'];

export default function MainShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullBleed = FULL_BLEED_ROUTES.includes(pathname);

  return (
    <main className={fullBleed ? 'flex-grow' : 'flex-grow container mx-auto px-4 py-8'}>
      {children}
    </main>
  );
}
