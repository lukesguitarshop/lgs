import { NextResponse, type NextRequest } from 'next/server';
import { listingPath } from '@/lib/seo';

/**
 * Gives listing addresses the status code they deserve, before the page renders.
 *
 * The listing page itself redirects old addresses and calls notFound(), but it
 * streams behind a loading skeleton, so by the time it knows the answer the response
 * has already gone out as a 200. Google then sees a "not found" page that claims to
 * be fine (a soft 404) and keeps crawling it, and treats the redirect as a
 * browser-side one. So for whole-page requests this looks the listing up first:
 *
 *   - no such listing            -> 404
 *   - bare id, or an old title   -> 308 to "/listing/<title-words>-<id>"
 *   - anything else              -> carries on to the page
 *
 * Clicks inside the site fetch page data rather than a whole page, and are left
 * alone, so browsing does not pay for a second lookup. If the lookup itself fails
 * the request carries on untouched: a slow API must not turn real guitars into 404s.
 */

const LISTING_SEGMENT = /^\/listing\/([^/]+)\/?$/;
const TRAILING_ID = /[0-9a-f]{24}$/i;

export async function proxy(request: NextRequest) {
  const match = LISTING_SEGMENT.exec(request.nextUrl.pathname);
  if (!match) return NextResponse.next();
  if (request.headers.has('rsc') || request.headers.has('next-router-prefetch')) {
    return NextResponse.next();
  }

  const id = TRAILING_ID.exec(match[1])?.[0];
  if (!id) return notFound(request);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://guitar-price-api.fly.dev/api';
  try {
    const res = await fetch(`${apiBaseUrl}/listings/${id}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (res.status === 404) return notFound(request);
    if (!res.ok) return NextResponse.next();

    const listing: { id?: string; listing_title?: string } = await res.json();
    if (!listing.id || !listing.listing_title) return NextResponse.next();

    const target = listingPath(listing.id, listing.listing_title);
    if (target === request.nextUrl.pathname) return NextResponse.next();

    const url = request.nextUrl.clone();
    url.pathname = target;
    return NextResponse.redirect(url, 308);
  } catch {
    return NextResponse.next();
  }
}

/** The page still renders its own "Listing not found" screen; only the status changes. */
function notFound(request: NextRequest) {
  return NextResponse.rewrite(request.nextUrl, { status: 404 });
}

export const config = {
  matcher: '/listing/:id',
};
