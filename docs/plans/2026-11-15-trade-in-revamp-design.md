# Trade-In Revamp - Design

## Why

`POST /api/trade-ins` inserts the request before it validates photos. A rejected
photo (over 5MB, wrong type) or a storage failure returns an error but leaves a
photo-less record behind. In production 5 of 10 trade-ins have zero photos; one
customer created three empty duplicates in five minutes before succeeding the
next day. There is also no admin email on submission, so requests sit unseen
(three from one customer have been "submitted" since 2026-09-10).

## Changes

### 1. Submit endpoint
- Validate fields and every photo (count, size, type) before any write.
- Generate the ObjectId up front, upload photos under `trade-ins/{id}/`, then
  insert the complete record once. On upload failure, delete the prefix and
  return an error; nothing is saved.
- Duplicate guard: if the same user has a request with the same brand, model
  and condition created in the last 10 minutes, return that request's id
  instead of creating another.
- Limits: 8 photos, 10MB each, request cap 85MB (the browser resizes, so the
  server limit is a backstop, not the normal path).

### 2. Photos in the browser
- Resize each photo to max 2000px on the long edge, JPEG quality 0.85, before
  upload. Falls back to the original file if the browser cannot decode it.
- Validate type and size when photos are picked; show errors inline under the
  photo grid instead of a toast after submit.

### 3. Email
- New: admin notification on every submission (brand, model, condition, photo
  count, link to the admin detail page).
- New: customer email when inspection is complete.

### 4. Admin
- Status transition guards on every action:
  - offer: from submitted, offered, declined, expired
  - label: accepted only
  - mark-received: accepted only
  - mark-inspected: received only
  - complete: inspected only
  - mark-paid: completed, cash offers, not already paid
  - cancel: anything except completed and cancelled
- List DTO gains `photoCount`, `thumbnailUrl`. List shows thumbnail, photo
  count, age, and a "waiting" flag for submitted requests older than 48 hours.

### 5. Customer
- `POST /api/trade-ins/{id}/cancel`: owner may cancel while status is
  submitted or offered (not yet accepted).
- An offer past its expiry is reported as status `expired` in the DTO (computed
  on read; no background job).
- `/trade-in/[id]` and `/account/trade-ins` restyled to the mobile-revamp
  language (square corners, label-mono, StateBlock, StickyBar), with a status
  timeline on the detail page.

## Not doing
- Per-photo upload with progress/drafts.
- Customer-side editing of a submitted request.
- Automatic cleanup of existing orphan records (manual, with owner approval).

## Testing
No backend test project exists. Verify locally against local Mongo: submit with
an oversized photo (no record created), submit happy path, duplicate submit,
each admin transition (allowed and refused), customer cancel, and the restyled
pages at phone and desktop widths.
