# Trade-In Revamp Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stop failed submissions leaving empty trade-in records, and tighten the whole trade-in flow (photos, notifications, admin guards, customer pages).

**Architecture:** No new collections or services. The submit endpoint is reordered to validate, upload, then insert once. Status rules live in one static helper used by both controllers. Photo resizing is a small browser helper. Design: `2026-11-15-trade-in-revamp-design.md`.

**Tech Stack:** ASP.NET Core + MongoDB driver (backend), Next.js + Tailwind (frontend). No backend test project exists, so each task is verified by `dotnet build`, `npx tsc --noEmit`, and the local end-to-end pass in Task 7.

---

### Task 1: Submit endpoint
**Files:** `backend/GuitarDb.API/Controllers/TradeInsController.cs`, `Services/MongoDbService.cs`
- Validate fields and all photos (1-8, each <= 10MB, JPEG/PNG/GIF/WebP) before any write.
- Add `MongoDbService.FindRecentDuplicateTradeInAsync(userId, brand, model, condition, since)`; if a match from the last 10 minutes exists, return its id.
- Generate `ObjectId.GenerateNewId()` first, upload photos to `trade-ins/{id}/`, insert the full record once. On upload exception: `DeletePrefixAsync`, log, return 500 with a readable error.
- Raise `RequestSizeLimit` / `MultipartBodyLengthLimit` to 85MB.
- Verify: `dotnet build backend/GuitarDb.API`.
- Commit: `fix(trade-in): validate and upload photos before saving the request`

### Task 2: Status rules, customer cancel, computed expiry
**Files:** `Models/TradeInRequest.cs`, `Controllers/TradeInsController.cs`, `Controllers/AdminTradeInsController.cs`, `DTOs/TradeInDtos.cs`
- Add static `TradeInRules` in `TradeInRequest.cs`: `EffectiveStatus(req)` (returns `expired` when status is `offered` and the last offer is past expiry and unanswered) plus `CanOffer/CanUploadLabel/CanReceive/CanInspect/CanComplete/CanMarkPaid/CanAdminCancel/CanCustomerCancel`.
- Admin actions return 400 `"Can't <action> a trade-in that is <status>"` when the rule fails.
- `POST /api/trade-ins/{id}/cancel` for the owner (submitted or offered/expired, nothing accepted).
- Both DTO mappers report `EffectiveStatus`. `AdminTradeInListItemDto` gains `PhotoCount`, `ThumbnailUrl`.
- Commit: `feat(trade-in): status transition guards and customer cancel`

### Task 3: Emails
**Files:** `Services/EmailService.cs`, both controllers
- `SendTradeInSubmittedAdminAsync(requestId, brand, model, condition, photoCount, userEmail)` to `_sellerEmail`, linking `/admin/trade-ins/{id}`; called from Submit.
- `SendTradeInInspectedAsync(toEmail, requestId, brand, model)`; called from MarkInspected.
- HTML-encode user-supplied brand/model in the new templates.
- Commit: `feat(trade-in): email admin on submission and customer on inspection`

### Task 4: Browser photo handling
**Files:** create `frontend/lib/resize-image.ts`; modify `frontend/app/trade-in/submit/page.tsx`
- `resizeImage(file, maxEdge = 2000, quality = 0.85)`: `createImageBitmap` + canvas -> JPEG `File`; returns the original on any failure or if already small.
- On pick: reject unsupported types and files that are still over 10MB after resize, with an inline message under the grid. Stable object URLs (revoke on remove).
- Commit: `feat(trade-in): resize photos in the browser and show inline errors`

### Task 5: Admin list and detail
**Files:** `frontend/lib/types/trade-in.ts`, `frontend/app/admin/trade-ins/page.tsx`, `frontend/app/admin/trade-ins/[id]/page.tsx`
- List: thumbnail + photo count in the Guitar column, age in the Date column, "Waiting Nd" badge for submitted requests older than 48h, "No photos" badge when `photoCount === 0`.
- Detail: show the offer form only when the rules allow an offer; label upload only when accepted.
- Commit: `feat(admin): trade-in list shows photos, age and waiting flag`

### Task 6: Customer pages
**Files:** `frontend/lib/api.ts`, `frontend/app/trade-in/[id]/page.tsx`, `frontend/app/account/trade-ins/page.tsx`
- `cancelTradeIn(id)` in api.ts.
- Detail page: mobile-revamp styling, status timeline (Submitted, Offer, Shipped, Inspected, Paid), cancel action while cancellable, `expired` block.
- Account list: same styling, readable status labels.
- Commit: `feat(trade-in): restyle customer pages, add timeline and cancel`

### Task 7: Verify
- `dotnet build`, `npx tsc --noEmit`, `npm run lint` on touched files.
- Run API against local Mongo and frontend on port 3000. Check: oversized/invalid photo leaves no record; happy path; duplicate submit returns the same id; each admin transition allowed and refused; customer cancel; pages at phone and desktop widths.
