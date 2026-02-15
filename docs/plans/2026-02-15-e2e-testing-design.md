# E2E Testing Design - Luke's Guitar Shop

**Date:** 2026-02-15
**Status:** Approved
**Approach:** Test-Driven with Playwright

## Overview

Implement comprehensive E2E testing for LGS using Playwright. Tests will drive discovery and fixing of issues marked [0] in MANUAL_TESTING.md, followed by a final manual verification pass.

## Test Structure

```
frontend/
├── e2e/
│   ├── fixtures/
│   │   └── auth.fixture.ts       # Login/register helpers
│   ├── tests/
│   │   ├── auth.spec.ts          # Registration, login, logout
│   │   ├── listings.spec.ts      # Browse, search, filter, detail
│   │   ├── cart.spec.ts          # Add, remove, view cart
│   │   ├── favorites.spec.ts     # Add/remove favorites
│   │   ├── offers.spec.ts        # Make/view/respond to offers
│   │   ├── checkout.spec.ts      # Stripe & PayPal flows
│   │   ├── messages.spec.ts      # Contact seller, chat
│   │   └── admin.spec.ts         # Admin portal operations
│   └── playwright.config.ts
```

### Conventions

- One spec file per feature area (matches MANUAL_TESTING.md sections)
- Shared fixtures for authentication state
- Tests run against `localhost:3000` (frontend) + `localhost:5000` (backend)

## Critical Flows (Priority Order)

| Priority | Flow | Tests | Notes |
|----------|------|-------|-------|
| **P0** | Auth | Register, login, logout, token persistence | Foundation for all other tests |
| **P0** | Listings | Browse, search, filter, detail page | Core browsing experience |
| **P1** | Cart | Add, remove, view, empty state | Pre-checkout flow |
| **P1** | Checkout | Stripe flow, PayPal flow, locked items | Revenue-critical |
| **P1** | Offers | Make offer, view offers, counter-offer response | [0] items here need fixing |
| **P2** | Favorites | Add, remove, view list | Lower priority feature |
| **P2** | Messages | Contact seller, view conversations | Has console error to fix |
| **P2** | Admin | Offers tab, accept/reject, orders tab | Admin-only flows |
| **P3** | Edge Cases | Disabled listing, expired cart items, concurrent offers | [0] items mostly here |

## [0] Items to Fix

From MANUAL_TESTING.md:

1. **Saved shipping address flow (7.5)** - Address pre-fill, save checkbox
2. **Pending cart items admin view (10.9, 10.10)** - Admin visibility, cancel functionality
3. **Checkout disabled item handling (11.2)** - Error when item disabled during checkout
4. **Expired pending cart item cleanup (11.3)** - TTL cleanup verification
5. **Concurrent offer accept handling (11.5)** - Graceful handling of race conditions
6. **Messages console error (9.2)** - "Failed to fetch listing price" error

## Test Data Strategy

- Use existing MongoDB data (test listings already exist)
- Dedicated test accounts:
  - `test-user@lgs.com` - regular user for buyer flows
  - `test-admin@lgs.com` - admin user for admin portal tests
- Tests clean up after themselves (delete created offers, messages, etc.)
- No mocking - real E2E against actual backend

## Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  baseURL: 'http://localhost:3000',
  timeout: 30000,
  retries: 1,
  workers: 1,
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
});
```

## Environment Requirements

- Backend running on `localhost:5000`
- Frontend running on `localhost:3000`
- MongoDB connected with test data
- Stripe test mode (card: 4242424242424242)
- PayPal sandbox credentials

## Execution Plan

### Phase 1: Setup
- Install Playwright in frontend
- Create config and fixture files
- Seed test accounts if needed

### Phase 2: Write Tests (P0 First)
- Auth tests - verify passing
- Listings tests - verify passing
- If tests fail - fix the issue immediately

### Phase 3: Write Tests (P1) + Fix [0] Items
- Cart tests
- Checkout tests - fix saved shipping address (7.5)
- Offers tests - fix counter-offer response flow (5.4)

### Phase 4: Write Tests (P2) + Fix Remaining
- Favorites tests
- Messages tests - fix console error (9.2)
- Admin tests - fix pending cart admin view (10.9, 10.10)

### Phase 5: Edge Cases (P3)
- Disabled listing checkout (11.2)
- Expired cart item handling (11.3)
- Concurrent offer handling (11.5)

### Phase 6: Final Manual Pass
- Quick walkthrough of full flow
- Update MANUAL_TESTING.md - mark [0] to [1]

## Expected Output

- Full Playwright test suite (~50-80 tests)
- All [0] items fixed
- Updated MANUAL_TESTING.md with passing status
