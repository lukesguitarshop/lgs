# Listing view counts and a fuller activity log

Approved 2026-11-23.

## Listing views and watchers

- The listing page reports a view from the browser after it loads (`POST /api/listings/{id}/view`), so crawlers and link previews that never run the page do not count.
- One view per visitor per listing per day. The server dedupes on a salted SHA-256 hash of client IP and user agent. Raw IPs are never stored; dedupe records expire after two days (TTL index).
- Not counted: signed-in admins, known bot user agents.
- Counts live in their own collections (`listing_view_counts`, `listing_view_marks`), not on the listing document, because listings are replaced wholesale on refresh.
- `GET /api/admin/listings` returns `view_count` and `watcher_count` (favorites per listing). The admin listings tab shows Views and Watchers on the desktop table and phone cards.
- Views start at zero on the day this ships. Watchers are correct immediately.

## Activity log

Only signed-in customers get entries. New event types:

| Group | Types |
|---|---|
| Listing views | `listing_view` (one per listing per day) |
| Offers and messages | `offer_made`, `offer_countered`, `offer_accepted`, `offer_declined`, `message_sent` |
| Account | `registered`, `email_verified`, `password_reset_requested`, `password_changed`, `profile_updated`, `newsletter_subscribed` |
| Checkout and other | `remove_from_cart`, `checkout_started`, `discount_applied`, `trade_in_submitted`, `review_left` |

- Logged on the server wherever the action already reaches the API.
- `remove_from_cart` and `checkout_started` happen in the browser and go through `POST /api/activity`, whose allowed-types list is extended.
- The admin Activity Logs filter and icons, and the per-user feed, cover the new types.

## Testing

Unit tests for the dedupe key and bot rules, then a local run: a second visit does not double-count, an admin visit does not count, and the new events appear in the feed.
