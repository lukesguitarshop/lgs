# UPS Auto-Delivery — Design

**Date:** 2026-08-21
**Status:** Approved

## Problem

Orders sit at `shipped` until somebody notices the package arrived and clicks
"Mark as Delivered" in the admin panel. Nobody does, so the customer-facing order
page shows a package as still in transit weeks after it landed.

## What already exists

The integration was written in `942ab13 feat: merge offers into messages and add
order tracking` and has never run:

- `UpsTrackingService` — UPS OAuth (client credentials, cached token) against
  `/security/v1/oauth/token`, then `/api/track/v1/details/{number}`. Parses
  `currentStatus.code == "D"` into `IsDelivered`.
- `DeliveryTrackingService` — hourly `BackgroundService`. Pulls shipped orders,
  skips non-UPS ones, marks delivered ones.
- Both registered in `Program.cs`.

It is inert because `UPS:ClientId` / `UPS:ClientSecret` are empty and neither Fly
app has a `UPS__*` secret. Verified by putting dummy credentials in local dev
config: the poller fired, found the order, called UPS, and failed only at
authentication (`401`). DI, the typed `HttpClient` and the loop are all sound.

So this is a configuration job plus some sharpening — not a build.

## Approach: keep polling

UPS Track Alert (push) needs a public subscription endpoint, per-shipment
registration at label time, and signature verification. Tracking numbers are
entered by hand in the admin panel, so there is no label event to register
against. Hourly polling of a handful of open orders costs a few calls a day and
already works. Revisit only if volume makes the call count matter.

## Changes

### A. Credentials (operator task)

A UPS Developer app with the Tracking API, then:

```
fly secrets set UPS__ClientId=... UPS__ClientSecret=... --app guitar-price-api-dev
```

Double underscore is .NET config nesting for `UPS:ClientId`; a single underscore
binds nothing and fails silently. Setting secrets restarts the machine, so the
poller picks them up on its own.

### B. Record when, not just whether

`Order` gains `shipped_at` and `delivered_at` (`DateTime?`). Both are stamped
inside the two `MongoDbService` chokepoints — `UpdateOrderTrackingAsync` and
`UpdateOrderStatusAsync` — so the UPS poller and the admin's manual "Mark as
Delivered" both record dates with no duplicated logic.

- `shipped_at` is stamped only the first time tracking lands, so editing a
  tracking number later does not reset the ship date.
- `delivered_at` uses UPS's actual delivery timestamp when the poller supplies
  one; a manual admin mark falls back to now. An explicit UPS date overwrites a
  manual guess, because UPS is the better source.

### C. Fix a latent bug in the delivery-date parse

`ParseTrackingResponse` reads `deliveryDate[0]`. UPS returns *typed* entries —
`DEL` (actual), `SDD` (scheduled), `RDD` (rescheduled) — so index 0 can record a
*scheduled* date as the delivery date. Select `type == "DEL"`, and parse UPS's
`yyyyMMdd` date plus `deliveryTime` into a real `DateTime`, falling back to now
when absent or unparseable.

`TrackingStatus.DeliveryDate` (string) becomes `DeliveredAt` (`DateTime?`). It
has no other consumers.

### D. Tighten the poll

`GetShippedOrdersAsync` fetches every shipped order forever and skips non-UPS
ones in the loop. Push the carrier filter into the Mongo query, and add an age
cutoff from `UPS:MaxTrackingAgeDays` (default 45), so a package that never
reports delivered stops being retried hourly for eternity.

Legacy orders predate `shipped_at`, so the cutoff falls back to `created_at`
when `shipped_at` is null.

### E. Surface it

`OrderDetailDto` gains `shippedAt` / `deliveredAt`. The timeline on
`/account/orders/{id}` renders the date under the step it belongs to —
"Shipped — March 2", "Delivered — March 6".

## Testing

Frontend: `orderTimeline` changes are covered by extending `lib/orders.test.ts`.

Backend: the solution has no test project, only `GuitarDb.API` and
`GuitarDb.Scraper`. Standing up xunit for one date parser is disproportionate, so
the parse stays defensive (every field optional, falls back rather than throws)
and is verified against real UPS responses during end-to-end checks.

End-to-end, once credentials are set: point a dev order at a real UPS tracking
number for an already-delivered package, watch the poller flip it, and confirm
the date renders on the order page.

## Out of scope

- USPS and FedEx auto-delivery. Those orders stay at `shipped` until marked by
  hand, exactly as today.
- A "your guitar arrived" customer email, and firing the existing
  `SendReviewRequestAsync` on delivery rather than by hand from the admin panel.
  Both are natural follow-ons; neither is part of this change.
