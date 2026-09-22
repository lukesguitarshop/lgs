# In-person checkout — design

Date: 2026-09-21

## Goal

Let Luke sell a guitar to someone standing in front of him who wants to pay by card but has
no account on the site. From a phone or laptop: open Admin → Other Tools → In-Person Sale,
pick the guitar, tap **Charge**, hand the phone over so the buyer completes the ordinary
Stripe Checkout, and land back on an admin confirmation page. The listing is marked sold
exactly as a web sale would mark it. The order is recorded with no account attached and is
flagged so the buyer's details can be filled in later from the Orders page.

## What happens on a normal card checkout, and whether it happens here

| Normal checkout step | In-person | Why |
|---|---|---|
| Buyer must be signed in | **No** | The whole point — the buyer has no account. The *admin* must be signed in instead; every endpoint is behind `[AdminAuthorize]`. |
| Cart / pending-cart merge | **No** | One guitar, chosen by the admin. Multi-item carts are out of scope. |
| Shipping address required up front | **Admin chooses** | Default is "handing it over now" — no address. If the guitar ships, Stripe's own address collection is turned on so the buyer types it on the Stripe page. |
| Reservation gate (403 if reserved for someone else) | **Warn, don't block** | Luke is in the room and knows who he is selling to. The tab shows a hold warning and requires an explicit acknowledgement before the session is created; at settlement the reservation is flagged for review with a reason, the same way the webhook handles a conflict. |
| Server-side price from listing / reservation | **Listing price, with an admin override** | Haggling happens in person. The admin can enter the agreed price; the browser never sets it on its own — the backend validates it is positive and stores it as the line item. |
| Store credit | **No** | No account to hold credit. |
| Stripe session: card only, free shipping option, success/cancel URLs from `FrontendUrl` | **Yes** | Same Stripe Checkout the site already uses. Success returns to an admin-only page; cancel returns to the tab. |
| Collect buyer email | **Yes** | Stripe collects it on every Checkout. We also turn on phone collection so the order carries a way to reach the buyer. |
| Idempotent completion (`/checkout/complete` + webhook fallback) | **Yes** | Settlement lives in one service, called from the admin success page, from the public complete endpoint, and from the webhook. First one wins; the rest return the existing order. |
| Write the order | **Yes**, with `source = in_person`, no `user_id`, `needs_details = true` | Name / email / phone come from Stripe when it has them; the admin confirms or completes them later. |
| Disable the listing | **Yes** | It is sold. |
| Mark finance transaction sold (`needs_review`) | **Yes** | Same as any sale — revenue etc. are filled in by hand. |
| Complete the reservation for this buyer | **No** | We cannot know the walk-in is the reservation holder. Flag for review instead. |
| Delete pending cart items for the listing | **Yes** | Somebody's locked cart item for a sold guitar must go. |
| Auto-reject open offers and email those buyers | **Yes** | The guitar is gone; the same "purchased by another buyer" email goes out. |
| Activity log entry for the buyer | **No** | No user. |
| Buyer confirmation email | **Yes, if Stripe captured an email** | A receipt worded for the situation — "handed over in person" or "we'll email tracking". |
| Seller notification email | **Yes** | Payment method reads "In person (Stripe)". |
| GA purchase event, clear localStorage cart | **No** | Admin's browser, not a shopper's. |
| Status | `delivered` when handed over (with `delivered_at` = now); `completed` when shipping | A handed-over guitar sitting at "being prepared" forever would be wrong in the Orders tab and in reporting. |

## Backend

### `Models/Order.cs`
New fields, all `[BsonIgnoreIfNull]` / default so existing documents deserialize unchanged:
- `source` — `"web"` (default) or `"in_person"`.
- `fulfillment` — `"ship"` (default) or `"handed_over"`.
- `buyer_name`, `buyer_phone` — filled from Stripe or by the admin. `guest_email` (already exists) holds the email.
- `admin_notes` — free text.
- `needs_details` — true until the admin saves buyer details.
- `created_by_admin_id` — who ran the sale.

### `Services/InPersonCheckoutService.cs` (new)
- `CreateSessionAsync(listing, price, fulfillment, adminUserId, note)` — builds the Stripe session: one line item at the agreed price, `PhoneNumberCollection` on, `ShippingAddressCollection` (US/CA) only when shipping, metadata `order_type=in_person`, `listing_ids`, `agreed_price`, `fulfillment`, `admin_user_id`, `note`. Success → `/admin/in-person/success?session_id=…`; cancel → `/admin/other-tools?tab=in-person&cancelled=1`.
- `SettleSessionAsync(Session expanded)` — idempotent. Writes the order, then runs the sold-listing side effects listed above and sends the two emails. Flags any active reservation on the listing for review.

### `Controllers/AdminInPersonCheckoutController.cs` (new), `api/admin/in-person-checkout`, `[AdminAuthorize]`
- `POST session` `{ listingId, price?, fulfillment, acknowledgeReservation?, note? }` → `{ sessionUrl, sessionId }`. 404 unknown listing, 400 already sold / bad price, 409 reserved without acknowledgement.
- `POST complete` `{ sessionId }` → order summary for the success page. Refuses sessions that are not `in_person` or not paid.

### `Controllers/CheckoutController.cs`
Both `complete` and the webhook branch on `order_type == in_person` and hand the session to the new service, so an admin whose token is missing on the redirect is still covered.

### `Controllers/AdminController.cs`
- `AdminOrderDto` gains `orderType`, `source`, `fulfillment`, `needsDetails`, `buyerPhone`, `adminNotes`, `deliveredAt`. Buyer name/email for account-less orders come from the order itself.
- `PATCH orders/{id}/details` `{ buyerName, buyerEmail, buyerPhone, adminNotes, shippingAddress? }` — only for orders with no `user_id` (an account is the source of truth otherwise). Clears `needs_details`.

### `Services/EmailService.cs`
`SendInPersonReceiptToBuyerAsync` — receipt with the right closing line for handed-over vs shipping.

## Frontend

- **Other Tools** gains an **In-Person Sale** tab (`components/admin/InPersonSaleTab.tsx`). Phone-first: a search box over active listings, tappable rows with photo / title / price / hold badge, then a checkout card: agreed price (prefilled), "Handing it over now" vs "Shipping it", optional note, hold acknowledgement when needed, and one primary **Charge $X** action — in a sticky bottom bar on phones, inline on desktop. Cancelled Stripe sessions return here with a notice.
- **`/admin/in-person/success`** — admin-gated. Settles the session, shows what was charged and to whom (as far as Stripe told us), and offers **Add buyer details** (→ `/order/{id}`), **New sale**, **Orders**.
- **Orders tab** — payment chip reads "In person" for these orders; a "Needs details" badge; buyer column shows what we have or "Walk-in"; row action "Add details".
- **`/order/[id]`** — for in-person orders: a warning block until details are saved; buyer card becomes an editable form (name, email, phone, notes); "Handed over in person" replaces the shipping and tracking cards when nothing ships.
- `lib/orders.ts` — `paymentLabel()` and `buyerDisplayName()` shared by the table, the order page and the PDF, with unit tests.

## Out of scope
Multiple guitars in one in-person sale, tax, PayPal in person, cash/Zelle recording, creating an account for the walk-in buyer.
