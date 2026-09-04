'use client';

import { usePathname } from 'next/navigation';

/**
 * The redesigned homepage runs full-bleed: its sections own their own max-width and
 * paint edge-to-edge bands behind the hero, the About block and the closing CTA. Every
 * other page still expects the centred container <main> used to provide, so the shell
 * keeps it for them rather than making seventeen pages grow their own wrapper.
 *
 * On phones the container's gutter is 20px and its vertical padding 24px; from md up it
 * is exactly what it was. The home route is a flex column below md because the phone
 * reads its sections in a different order from desktop (hero, inventory, about, sold,
 * trust, terms, contact) and each section carries an `order-N md:order-none` class —
 * `order` only takes effect inside a flex or grid parent, so <main> has to be one.
 *
 * Children are passed through untouched, so server components stay server components.
 */
const FULL_BLEED_ROUTES = ['/'];

export default function MainShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullBleed = FULL_BLEED_ROUTES.includes(pathname);

  return (
    <main
      className={
        fullBleed
          ? 'flex flex-grow flex-col md:block'
          : 'flex-grow container mx-auto px-5 py-6 md:px-4 md:py-8'
      }
    >
      {children}
    </main>
  );
}
