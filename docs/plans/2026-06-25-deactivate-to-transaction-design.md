# Deactivate Listing → Transaction Linking

**Date:** 2026-06-25

## Goal
When a listing is deactivated in the admin portal, make it easy to update the
corresponding finance transaction. Two flows:

1. **Manual deactivate** (admin clicks *Disable*): after disabling, prompt
   "Edit this listing's transaction in Finances?" No → close; Yes → jump to the
   Transactions tab with that transaction's edit modal open (normal edit, no
   auto-fill). If no linked transaction exists → "not found" toast.
2. **Order-triggered deactivate** (auto): when a website order disables a
   listing, auto-update its transaction: `for_sale → sold`, date → sale date,
   platform → `lukesguitarshop.com`, and flag it `needs_review`. Revenue,
   shipping, profit, payout, and tracking are left blank for the admin.

The admin is alerted to `needs_review` transactions via a persistent
"Action needed" badge on the row plus a toast when opening the Transactions tab.

## Linking
`Transaction` gains a `listing_id` field. Set on the scraper's auto-created
`for_sale` transaction and on order updates. Lookups match by `listing_id`
first, falling back to `guitar_name == listing_title` for legacy rows (no
migration required).

## Backend changes
- `Models/Transaction.cs`: add `ListingId` (`listing_id`) and `NeedsReview`
  (`needs_review`).
- `Services/ScraperService.cs`: set `ListingId` on the auto-created transaction.
- `Services/MongoDbService.cs`:
  - `GetTransactionByListingIdAsync(listingId, title)` — listing_id then title fallback.
  - `MarkListingsSoldInTransactionsAsync(listingIds, saleDate)` — order auto-fill.
- `Controllers/AdminController.cs`:
  - Include `listingId` + `needsReview` in the transactions projection.
  - `GET transactions/by-listing/{listingId}`.
  - `UpdateTransaction`: clear `NeedsReview` on save.
- `Controllers/CheckoutController.cs`: call `MarkListingsSoldInTransactionsAsync`
  after each `DisableListingsByIdsAsync` (card, PayPal, webhook).

## Frontend changes
- `lib/types/transaction.ts`: add `listingId`, `needsReview`.
- `app/admin/page.tsx`: on *Disable* (active→disabled), look up the linked
  transaction; show confirm modal; Yes → `router.push('/finances?editTxn=<id>')`;
  no match → toast.
- `components/admin/TransactionsTab.tsx`: read `editTxn` query param → open edit
  modal; toast on load when any `needsReview`; "Action needed" badge per row.

## Decisions (from user)
- Order auto-fill: type, date, platform only (not revenue).
- Action-needed: persistent badge + toast.
- Manual no-match: show "not found".
- Linking: add `listing_id`.
