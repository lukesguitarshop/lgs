# Trade-In Feature - Design Document

## Overview

Allow logged-in users to submit guitars for trade-in. Admin reviews each submission and replies with two manual offers — a lower **cash** offer and a higher **store credit** offer. User picks one (or declines), ships the guitar with an admin-supplied prepaid label, and receives payout after inspection.

Store credit is a real, redeemable balance integrated into the existing checkout flow (not a paper coupon).

## Goals & Non-Goals

**Goals:**
- Public landing page with trust copy + 3-step process explainer
- Login-gated submission form (brand, model, condition, notes, photos)
- Admin can review, send dual offers, mark received/inspected/completed, upload label, mark cash paid
- Two email-driven user flows: cash payout (manual via PayPal) and store credit (auto-applied at checkout)
- Mobile-friendly photo upload from phones

**Non-goals (explicitly NOT building):**
- Auto pricing, AI image analysis, instant quotes
- Counter-offers from the user side
- PayPal Payouts API automation (manual outside the app)
- EasyPost/Shippo label automation (admin uploads PDF)
- Box-shipping (instructions only)
- Reimbursing packing cost
- Public dashboard / advanced reporting

## User Flows

### Submission flow
1. Visitor lands on `/trade-in` (public landing page with trust section + CTA)
2. Click "Start Trade-In" → `/trade-in/submit`
3. If not logged in, redirected to `/login?redirect=/trade-in/submit` (same pattern as checkout)
4. After login, fills form → submit → `/trade-in/[id]/submitted` confirmation
5. Receives "we got your request" email

### Offer-review flow
1. Admin sends offer → user gets "your offer is ready" email with link to `/trade-in/[id]`
2. User views offer page (auth-gated; only owner can see)
3. User clicks **Accept Cash** (enters PayPal email), **Accept Credit**, or **Decline**
4. On accept → "next steps: shipping" email + `/trade-in/[id]` shows shipping instructions + downloadable label PDF (once admin uploads it)
5. User ships guitar; admin physically receives, marks Received → Inspected → Completed
6. On Completed:
   - **Cash path**: admin sends PayPal manually, clicks "Mark as Paid" → user gets payment-sent email
   - **Credit path**: store credit balance is created/incremented on the user's account → user gets "credit available" email; visible at `/account/credit`

### Checkout integration
- New "Apply store credit" toggle on `/cart` and `/checkout`
- If user has a balance, a checkbox appears: "Apply $X store credit"
- On confirm, order total is reduced by the applied amount; on payment success, the credit balance is decremented

## Status State Machine

```
Submitted
  ├─→ Offered
  │     ├─→ Accepted-Cash ─→ Received ─→ Inspected ─→ Completed (admin MarksPaid)
  │     ├─→ Accepted-Credit ─→ Received ─→ Inspected ─→ Completed (credit issued)
  │     ├─→ Declined        (terminal)
  │     └─→ Expired         (auto, terminal — admin can re-offer)
  └─→ Cancelled              (admin override, terminal)
```

Note: The single `Status` enum collapses the cash/credit branch into a per-offer `AcceptedType` field on the active offer. Status values: `Submitted`, `Offered`, `Accepted`, `Declined`, `Expired`, `Received`, `Inspected`, `Completed`, `Cancelled`.

## Data Model (MongoDB, embedded sub-documents)

### `trade_in_requests` collection

```
{
  _id: ObjectId
  user_id: ObjectId                      // owner — required, login-gated submission
  email: string                          // snapshot from user at submit time
  brand: string
  model: string
  condition: string                      // "Excellent" | "Very Good" | "Good" | "Fair"
  notes: string
  photos: [
    {
      url: string                        // /uploads/trade-ins/{requestId}/{guid}.jpg
      original_file_name: string
      uploaded_at: DateTime
    }
  ]
  offers: [                              // append-only; latest is the "active" offer
    {
      cash_offer: decimal
      store_credit_offer: decimal
      expires_at: DateTime
      created_at: DateTime
      created_by_admin_id: ObjectId
      accepted_type: "cash" | "credit" | null
      accepted_at: DateTime?
      paypal_email: string?              // collected when user accepts cash
      declined_at: DateTime?
    }
  ]
  status: string                         // see state machine above
  shipping: {                            // populated on accept
    label_url: string?                   // admin-uploaded PDF, served from /uploads/trade-ins/{id}/label.pdf
    label_uploaded_at: DateTime?
    received_at: DateTime?
    inspected_at: DateTime?
    inspection_notes: string?
  }
  payout: {                              // populated on completion
    completed_at: DateTime?
    paid_at: DateTime?                   // cash path only
    paypal_transaction_id: string?       // optional, admin-entered
    store_credit_id: ObjectId?           // credit path only — points at the StoreCredit doc
  }
  created_at: DateTime
  updated_at: DateTime
}
```

### `store_credits` collection (new)

```
{
  _id: ObjectId
  user_id: ObjectId                      // owner
  balance: decimal                       // current available balance
  history: [
    {
      type: "credit" | "debit"
      amount: decimal
      reason: string                     // e.g. "trade-in {requestId}" | "order {orderId}"
      ref_id: ObjectId?                  // trade-in id or order id
      created_at: DateTime
    }
  ]
  created_at: DateTime
  updated_at: DateTime
}
```

One doc per user. Created lazily on first credit issuance.

### `orders` collection (existing — additive change)

Add fields:
- `store_credit_applied: decimal` (default 0)
- `store_credit_id: ObjectId?` (which credit doc was debited)

These don't alter existing order behavior — just record the discount when applied.

## API Endpoints

### Public (auth required)
- `POST   /api/trade-ins`                    — submit a new request (multipart: fields + photos)
- `GET    /api/trade-ins/{id}`               — view own request (owner-or-admin only)
- `POST   /api/trade-ins/{id}/accept`        — body: `{ type: "cash" | "credit", paypalEmail?: string }`
- `POST   /api/trade-ins/{id}/decline`       — decline current active offer
- `GET    /api/trade-ins/me`                 — list current user's trade-ins (for an `/account/trade-ins` page)

### Store credit (auth required)
- `GET    /api/store-credit/me`              — balance + history for current user
- `POST   /api/store-credit/preview-apply`   — body: `{ orderTotal }` → returns `{ availableToApply }` (clamped to balance + total)

### Checkout integration
- Existing `POST /api/checkout/...` endpoints take a new optional `applyStoreCredit: bool` flag. When true, server re-validates balance, creates a Stripe session for the reduced amount, and on payment success debits the credit doc.

### Admin (`[AdminAuthorize]`)
- `GET    /api/admin/trade-ins`              — list, supports `?status=` filter
- `GET    /api/admin/trade-ins/{id}`         — full detail
- `POST   /api/admin/trade-ins/{id}/offer`   — body: `{ cashOffer, storeCreditOffer, expirationDays }`
- `POST   /api/admin/trade-ins/{id}/label`   — multipart: PDF upload
- `POST   /api/admin/trade-ins/{id}/mark-received`
- `POST   /api/admin/trade-ins/{id}/mark-inspected`     — body: `{ notes? }`
- `POST   /api/admin/trade-ins/{id}/complete`           — finalizes: cash path leaves status awaiting "mark paid"; credit path issues credit immediately
- `POST   /api/admin/trade-ins/{id}/mark-paid`          — body: `{ paypalTransactionId? }` (cash only)
- `POST   /api/admin/trade-ins/{id}/cancel`             — admin escape hatch

## Frontend Pages

### Public / user-facing
- `app/trade-in/page.tsx`                 — landing page (trust section, 3-step explainer, CTA)
- `app/trade-in/submit/page.tsx`          — form (login-gated, redirects to login like checkout)
- `app/trade-in/[id]/page.tsx`            — offer view + post-accept shipping view (single page, content varies by status)
- `app/trade-in/[id]/submitted/page.tsx`  — confirmation page after submit
- `app/account/trade-ins/page.tsx`        — user's request history (simple list)
- `app/account/credit/page.tsx`           — store credit balance + history

### Admin
- `app/admin/trade-ins/page.tsx`          — list view (Email, Guitar, Status, Date, filter by status)
- `app/admin/trade-ins/[id]/page.tsx`     — detail (submission + photos + offer form + status actions + label upload + mark paid)

### Checkout updates
- `app/cart/page.tsx`                     — show available store credit, "Apply credit" toggle
- `app/checkout/page.tsx`                 — show applied credit on order summary; re-validate on submit

## Email Triggers

| Event | Trigger | To | Subject |
|-------|---------|-----|---------|
| Request submitted | User submits | User | "We received your trade-in request" |
| Offer ready | Admin sends offer | User | "Your trade-in offer is ready" |
| Cash accepted | User accepts cash | User | "Next steps: shipping your guitar" |
| Credit accepted | User accepts credit | User | "Next steps: shipping your guitar" |
| Declined | User declines | Admin | "Trade-in offer declined" |
| Received | Admin marks received | User | "We got your guitar — inspecting now" |
| Cash paid | Admin marks paid | User | "Your trade-in payment is on the way" |
| Credit issued | Admin completes credit-path | User | "Your store credit is ready to spend" |

All sent via existing `EmailService`. Templates live alongside existing offer/order templates.

## Storage & Uploads

- Photos: `wwwroot/uploads/trade-ins/{requestId}/{guid}.{ext}`
- Label PDFs: `wwwroot/uploads/trade-ins/{requestId}/label.pdf`
- Same constraints as messages: max 8 photos per request, 5MB each, total 25MB; types JPEG/PNG/GIF/WebP. Label: PDF only, max 10MB.

## Security & Access Rules

- All `/api/trade-ins/*` endpoints require auth; non-admin can only access requests where `user_id == claim.userId`.
- Offer page `/trade-in/[id]` server-checks ownership; non-owner sees 404.
- Admin endpoints are `[AdminAuthorize]`-protected per existing pattern.
- Store credit balance is server-authoritative; checkout always re-validates before debit.

## Open Decisions / Defaults

- **Offer expiration default**: 7 days, admin can override per offer.
- **Re-offering after expiry/decline**: allowed — admin can send a new offer; the new one becomes "active" by virtue of being last in the array.
- **Disclaimer text** on the offer page: "Final offer subject to inspection. If condition differs, offer may be adjusted."
- **No partial credit application**: user toggles "apply all available" or doesn't apply (simplifies math; can split later if needed).

## Testing

- Backend: no existing test infrastructure — manual + Swagger smoke testing.
- Frontend: add Playwright e2e covering happy path (submit → offer → accept credit → see credit balance) at `frontend/e2e/trade-in.spec.ts`.

## Deployment

- Backend → dev: `cd backend/GuitarDb.API && fly deploy --app guitar-price-api-dev`
- Frontend → dev: `git push origin master:dev`
- No new env vars or secrets required (uses existing Mongo, SMTP, JWT config).
- No DB migration step — Mongo schemas grow on first write; new indexes added in `MongoDbService.CreateIndexesAsync`.

## Implementation Phases

To ship in reviewable chunks rather than one mega-PR:

1. **Backend foundation**: models + service + admin + user controllers (no UI yet, swagger-tested)
2. **Store credit foundation**: collection + service + balance/history endpoints
3. **User-facing UI**: landing, submit form, offer page, confirmation, account history
4. **Admin UI**: list + detail + actions
5. **Checkout integration**: cart toggle + checkout deduction + order schema additive change
6. **Email templates + triggers**: wire all 8 events
7. **Polish + e2e**: Playwright happy path, mobile QA, dev deploy
