import { redirect } from 'next/navigation';

/**
 * Reservations moved into Other Tools — holds are occasional, so they don't
 * warrant a permanent top-level tab.
 *
 * This route stays as a redirect because the admin notification emails
 * (deposit paid, expiring digest, needs review) link here.
 */
export default function ReservationsRedirect() {
  redirect('/admin/other-tools?tab=reservations');
}
