import { redirect } from 'next/navigation';

/**
 * The reviews live in a tab on Shop Info. The listing page's reviews carousel has always
 * linked here, which used to 404 — this sends it to the right place.
 */
export default function ReviewsPage() {
  redirect('/shop-info?tab=reviews');
}
