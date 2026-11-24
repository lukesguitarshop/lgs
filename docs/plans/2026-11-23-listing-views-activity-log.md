# Listing Views and Activity Log Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show per-listing view and watcher counts to the admin, and record a fuller set of customer events in the activity log.

**Architecture:** The listing page posts a view beacon to a new anonymous endpoint. A pure `ListingViewRules` class decides whether a request counts (bot, admin) and builds the per-day dedupe key; MongoDB enforces uniqueness with a unique index on `listing_view_marks` and increments `listing_view_counts`. Activity events are added with the existing `MongoDbService.LogActivityAsync` at each server action, plus two browser-originated types through `POST /api/activity`.

**Tech Stack:** ASP.NET Core + MongoDB.Driver, xUnit, Next.js (App Router) + TypeScript.

Design: `docs/plans/2026-11-23-listing-views-activity-log-design.md`

---

### Task 1: View rules (pure, test-first)

**Files:**
- Create: `backend/GuitarDb.API/Services/ListingViewRules.cs`
- Test: `backend/GuitarDb.API.Tests/ListingViewRulesTests.cs`

Steps: write failing tests, run `dotnet test backend/GuitarDb.API.Tests --filter ListingViewRules` (expect compile failure), implement, re-run (expect pass).

Behaviour:
- `IsBot(userAgent)`: true for null/empty and for agents containing bot, crawl, spider, slurp, headless, lighthouse, preview, monitor, curl, wget, python-requests, facebookexternalhit.
- `VisitorKey(ip, userAgent, salt, day)`: lowercase hex SHA-256 of `salt|yyyy-MM-dd|ip|userAgent`. Same inputs give the same key; a different day, IP, agent or salt gives a different key; the raw IP never appears in the key.

### Task 2: Storage and endpoint

**Files:**
- Create: `backend/GuitarDb.API/Models/ListingView.cs` (`ListingViewMark`, `ListingViewCount`)
- Modify: `backend/GuitarDb.API/Services/MongoDbService.cs` (collections, indexes, `RecordListingViewAsync`, `GetListingViewCountsAsync`, `GetWatcherCountsAsync`, `HasActivityTodayAsync`)
- Modify: `backend/GuitarDb.API/Controllers/MyListingsController.cs` (`POST api/listings/{id}/view`)

- `listing_view_marks`: `{listing_id, visitor, created_at}`; unique index on `(listing_id, visitor)`; TTL two days on `created_at`. The visitor key already contains the day.
- `listing_view_counts`: `{_id: listingId, count}`; `$inc` with upsert only when the mark insert succeeds (duplicate key means already counted).
- Endpoint: anonymous; returns 204 always. Skips bots and admins. Client IP from `Fly-Client-IP`, then `X-Forwarded-For`, then the connection. Salt from `ListingViews:Salt`, falling back to `Jwt:Key`.
- For a signed-in non-admin, log `listing_view` once per listing per day.

### Task 3: Admin counts

**Files:**
- Modify: `backend/GuitarDb.API/Controllers/AdminController.cs:268-317` (add `view_count`, `watcher_count`)
- Modify: `frontend/app/admin/page.tsx` (`AdminListing` type, Views and Watchers columns)

### Task 4: View beacon

**Files:**
- Modify: `frontend/lib/api.ts` (`recordListingView`)
- Modify: `frontend/app/listing/[id]/ListingDetail.tsx` (call once per listing id on mount; send the auth token when present; ignore failures)

### Task 5: Server-side activity events

**Files:**
- Modify: `AuthController.cs` (`registered`, `email_verified`, `password_reset_requested`, `password_changed`, `profile_updated`, `newsletter_subscribed` when the profile turns the newsletter on)
- Modify: `MessagesController.cs` (`message_sent`, `offer_made`, `offer_countered`, `offer_accepted`, `offer_declined`; only when the actor is the customer)
- Modify: `CheckoutController.cs` (`discount_applied` on a successful quote, `checkout_started` when a session or PayPal order is created)
- Modify: `TradeInsController.cs` (`trade_in_submitted`)
- Modify: `ReviewsController.cs` (`review_left`)

### Task 6: Browser-originated events and admin feed

**Files:**
- Modify: `backend/GuitarDb.API/Controllers/ActivityController.cs` (allow `remove_from_cart`)
- Modify: the frontend cart helper that already posts `add_to_cart` (post `remove_from_cart`)
- Modify: `frontend/app/admin/other-tools/page.tsx` and `frontend/app/admin/user/[id]/page.tsx` (filter options, icons)

### Task 7: Verify

- `dotnet test backend/GuitarDb.API.Tests`, `dotnet build backend/GuitarDb.API`
- Frontend type-check and lint.
- Local full stack (local Mongo, frontend on port 3000): view a listing twice (count stays 1), view as admin (no change), check the Activity Logs tab.
