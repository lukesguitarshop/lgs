import { NextResponse, type NextRequest } from 'next/server';
import { listingPath } from '@/lib/seo';

/**
 * Sends old listing addresses ("/listing/<id>") to the descriptive one
 * ("/listing/<title-words>-<id>") with a real 308.
 *
 * The listing page also redirects, but it streams behind a loading skeleton, so by
 * the time it knows the title the response has already gone out as a 200 and the
 * redirect happens in the browser. Google passes ranking through a 308; a
 * browser-side redirect it merely tolerates. Every link Google, emails and
 * bookmarks hold today is a bare id, so those are worth doing properly.
 *
 * Only bare ids are handled here, which keeps the extra API lookup off every normal
 * page view. If the lookup fails the request carries on to the page untouched.
 */

const BARE_ID = /^\/listing\/([0-9a-f]{24})\/?$/i;

export async function proxy(request: NextRequest) {
  const match = BARE_ID.exec(request.nextUrl.pathname);
  if (!match) return NextResponse.next();

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://guitar-price-api.fly.dev/api';
  try {
    const res = await fetch(`${apiBaseUrl}/listings/${match[1]}`, {
      signal: AbortSignal.timeout(4000),
    });
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

export const config = {
  matcher: '/listing/:id',
};
