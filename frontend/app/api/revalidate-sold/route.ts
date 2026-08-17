import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

// The /sold page caches its fetch of the whole archive, which otherwise leaves a deleted or
// re-enabled guitar on the page until the window expires. Admin actions that change what is
// sold call this to drop the cached page immediately.
//
// No secret guards this: the only thing it can do is discard a cached page, so the worst a
// caller achieves is forcing one extra fetch of the sold archive on the next visit.
export async function POST() {
  revalidatePath('/sold');
  return NextResponse.json({ revalidated: true });
}
