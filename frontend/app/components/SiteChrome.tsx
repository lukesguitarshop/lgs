'use client';

import { usePathname } from 'next/navigation';
import { isAdminRoute } from '@/lib/admin-nav';

/**
 * Wraps the storefront header and footer. On admin routes the wrapper is marked so
 * globals.css can drop them for the owner on desktop, where the admin sidebar takes
 * over. `display: contents` keeps the wrapper out of layout, so the sticky header still
 * sticks to the page rather than to this box.
 */
export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="site-chrome" data-admin-route={isAdminRoute(pathname) ? '' : undefined}>
      {children}
    </div>
  );
}
