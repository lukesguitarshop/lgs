# Order Cancellation Design

## Overview

Add the ability for admins to cancel an order and automatically send a cancellation email to the buyer. Cancellation is reversible — an admin can restore a cancelled order back to "completed".

## Approach

Extend the existing `PATCH /api/admin/orders/{id}/status` endpoint to accept `"cancelled"` as a valid status and fire a cancellation email when that status is set. This mirrors the existing pattern where the tracking endpoint fires a shipping email when status transitions to "shipped".

## Backend Changes

### `AdminController.cs`
- Add `"cancelled"` to the allowed status values in `UpdateOrderStatus`
- After updating status to `"cancelled"`, call `_emailService.SendOrderCancellationEmailAsync(order, buyerEmail)`
- No email is sent when restoring from cancelled (status set back to `"completed"`)

### `EmailService.cs`
- Add `SendOrderCancellationEmailAsync(Order order, string buyerEmail)`
- Template mirrors `SendOrderConfirmationToBuyerAsync`: same HTML structure, brand colors, order reference, item list
- Subject: `"Your order has been cancelled – Luke's Guitar Shop"`
- Body message: order reference, item list, and a note that the refund is processing and will appear within 5–10 business days

## Frontend Changes

### `app/admin/page.tsx`
- Add `"cancelled"` → `"Cancelled"` to `getStatusDisplay()` with a red badge color
- Add **Cancel Order** button per row, visible when status is not `"cancelled"`
  - Calls `PATCH /admin/orders/{id}/status` with `{ status: "cancelled" }`
  - Refreshes order list on success
- Add **Restore Order** button per row, visible when status is `"cancelled"`
  - Calls `PATCH /admin/orders/{id}/status` with `{ status: "completed" }`
  - Refreshes order list on success
- Both buttons are confirmation-free (admin intent is clear from the dedicated button)

## Data Flow

```
Admin clicks "Cancel Order"
  → PATCH /admin/orders/{id}/status { status: "cancelled" }
  → AdminController validates status
  → MongoDbService.UpdateOrderStatusAsync()
  → EmailService.SendOrderCancellationEmailAsync() [fire-and-forget]
  → 200 OK
  → Frontend refreshes order list

Admin clicks "Restore Order"
  → PATCH /admin/orders/{id}/status { status: "completed" }
  → AdminController validates status
  → MongoDbService.UpdateOrderStatusAsync()
  → No email sent
  → 200 OK
  → Frontend refreshes order list
```

## Out of Scope

- Automatic refund processing via Stripe/PayPal API (refund is manual; email just says it's processing)
- Buyer-facing cancellation requests
- Cancellation reason tracking
