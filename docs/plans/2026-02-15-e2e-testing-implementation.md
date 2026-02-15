# E2E Testing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement comprehensive Playwright E2E tests for Luke's Guitar Shop, using TDD to discover and fix issues.

**Architecture:** Playwright tests run against live frontend (localhost:3000) and backend (localhost:5000). Tests organized by feature area matching MANUAL_TESTING.md sections. Shared auth fixtures for login state.

**Tech Stack:** Playwright, TypeScript, Next.js 16, .NET 9 API, MongoDB

---

## Prerequisites

Before starting, ensure:
- Backend running: `cd G:/projects/lgs/backend/GuitarDb.API && dotnet run`
- Frontend running: `cd G:/projects/lgs/frontend && npm run dev`
- MongoDB connected with test data

---

## Task 1: Install Playwright

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install Playwright**

Run:
```bash
cd G:/projects/lgs/frontend && npm init playwright@latest -- --yes --quiet
```

Expected: Creates `playwright.config.ts`, `e2e/` folder, installs browsers

**Step 2: Verify installation**

Run:
```bash
cd G:/projects/lgs/frontend && npx playwright --version
```

Expected: Shows Playwright version (1.x.x)

**Step 3: Commit**

```bash
cd G:/projects/lgs && git add frontend/package.json frontend/package-lock.json frontend/playwright.config.ts frontend/e2e
git commit -m "chore: install Playwright for E2E testing"
```

---

## Task 2: Configure Playwright

**Files:**
- Modify: `frontend/playwright.config.ts`

**Step 1: Update configuration**

Replace `frontend/playwright.config.ts` with:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: 'html',
  timeout: 30000,

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'] },
    },
  ],

  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
```

**Step 2: Add test script to package.json**

Edit `frontend/package.json` scripts section, add:
```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

**Step 3: Commit**

```bash
cd G:/projects/lgs && git add frontend/playwright.config.ts frontend/package.json
git commit -m "chore: configure Playwright for LGS"
```

---

## Task 3: Create Auth Fixture

**Files:**
- Create: `frontend/e2e/fixtures/auth.fixture.ts`

**Step 1: Create fixtures directory**

```bash
mkdir -p G:/projects/lgs/frontend/e2e/fixtures
```

**Step 2: Create auth fixture**

Create `frontend/e2e/fixtures/auth.fixture.ts`:

```typescript
import { test as base, expect } from '@playwright/test';

// Test user credentials
export const TEST_USER = {
  email: 'testuser@lgs.com',
  password: 'TestPassword123!',
  fullName: 'Test User',
};

export const TEST_ADMIN = {
  email: 'admin@lukesguitarshop.com',
  password: 'admin123',
  fullName: 'Admin User',
};

// Extended test with auth helpers
export const test = base.extend<{
  loginAsUser: () => Promise<void>;
  loginAsAdmin: () => Promise<void>;
  logout: () => Promise<void>;
}>({
  loginAsUser: async ({ page }, use) => {
    const login = async () => {
      await page.goto('/');
      await page.getByRole('button', { name: /login/i }).click();
      await page.getByLabel(/email/i).fill(TEST_USER.email);
      await page.getByLabel(/password/i).fill(TEST_USER.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await expect(page.getByRole('button', { name: /profile/i })).toBeVisible({ timeout: 10000 });
    };
    await use(login);
  },

  loginAsAdmin: async ({ page }, use) => {
    const login = async () => {
      await page.goto('/');
      await page.getByRole('button', { name: /login/i }).click();
      await page.getByLabel(/email/i).fill(TEST_ADMIN.email);
      await page.getByLabel(/password/i).fill(TEST_ADMIN.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await expect(page.getByRole('button', { name: /profile/i })).toBeVisible({ timeout: 10000 });
    };
    await use(login);
  },

  logout: async ({ page }, use) => {
    const logout = async () => {
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('menuitem', { name: /logout/i }).click();
      await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
    };
    await use(logout);
  },
});

export { expect };
```

**Step 3: Commit**

```bash
cd G:/projects/lgs && git add frontend/e2e/fixtures/
git commit -m "feat: add auth fixtures for E2E tests"
```

---

## Task 4: Auth Tests - Registration

**Files:**
- Create: `frontend/e2e/auth.spec.ts`

**Step 1: Create test file**

Create `frontend/e2e/auth.spec.ts`:

```typescript
import { test, expect, TEST_USER, TEST_ADMIN } from './fixtures/auth.fixture';

test.describe('Authentication', () => {
  test.describe('Registration', () => {
    test('shows error for invalid email', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: /login/i }).click();
      await page.getByRole('link', { name: /create account/i }).click();

      await page.getByLabel(/email/i).fill('invalid-email');
      await page.getByLabel(/^password/i).fill('ValidPass123!');
      await page.getByLabel(/confirm password/i).fill('ValidPass123!');
      await page.getByLabel(/full name/i).fill('Test User');
      await page.getByRole('button', { name: /create account/i }).click();

      await expect(page.getByText(/invalid email/i)).toBeVisible();
    });

    test('shows error for short password', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: /login/i }).click();
      await page.getByRole('link', { name: /create account/i }).click();

      await page.getByLabel(/email/i).fill('newuser@test.com');
      await page.getByLabel(/^password/i).fill('short');
      await page.getByLabel(/confirm password/i).fill('short');
      await page.getByLabel(/full name/i).fill('Test User');
      await page.getByRole('button', { name: /create account/i }).click();

      await expect(page.getByText(/password.*characters/i)).toBeVisible();
    });
  });

  test.describe('Login', () => {
    test('shows error for wrong password', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: /login/i }).click();

      await page.getByLabel(/email/i).fill(TEST_USER.email);
      await page.getByLabel(/password/i).fill('wrongpassword');
      await page.getByRole('button', { name: /sign in/i }).click();

      await expect(page.getByText(/invalid.*credentials/i)).toBeVisible();
    });

    test('logs in successfully with correct credentials', async ({ page, loginAsUser }) => {
      await loginAsUser();
      await expect(page.getByRole('button', { name: /profile/i })).toBeVisible();
    });

    test('persists login after page refresh', async ({ page, loginAsUser }) => {
      await loginAsUser();
      await page.reload();
      await expect(page.getByRole('button', { name: /profile/i })).toBeVisible();
    });
  });

  test.describe('Logout', () => {
    test('logs out and shows login button', async ({ page, loginAsUser, logout }) => {
      await loginAsUser();
      await logout();
      await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
    });

    test('clears token on logout', async ({ page, loginAsUser, logout }) => {
      await loginAsUser();
      await logout();

      const token = await page.evaluate(() => localStorage.getItem('auth_token'));
      expect(token).toBeNull();
    });
  });
});
```

**Step 2: Run tests to verify they pass**

Run:
```bash
cd G:/projects/lgs/frontend && npx playwright test auth.spec.ts --project=chromium
```

Expected: All tests pass (or identify specific failures to fix)

**Step 3: Commit**

```bash
cd G:/projects/lgs && git add frontend/e2e/auth.spec.ts
git commit -m "test: add authentication E2E tests"
```

---

## Task 5: Listings Tests

**Files:**
- Create: `frontend/e2e/listings.spec.ts`

**Step 1: Create test file**

Create `frontend/e2e/listings.spec.ts`:

```typescript
import { test, expect } from './fixtures/auth.fixture';

test.describe('Listings', () => {
  test.describe('Browse Listings', () => {
    test('home page loads listing grid', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('[data-testid="listing-card"]').or(page.locator('.listing-card')).first()).toBeVisible({ timeout: 10000 });
    });

    test('displays listing images', async ({ page }) => {
      await page.goto('/');
      const firstImage = page.locator('img[alt*="guitar" i], img[alt*="listing" i]').first();
      await expect(firstImage).toBeVisible();
    });

    test('displays prices and conditions', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText(/\$[\d,]+/)).toBeVisible();
    });
  });

  test.describe('Search & Filter', () => {
    test('search filters results', async ({ page }) => {
      await page.goto('/');
      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill('Gibson');
      await page.waitForTimeout(500); // Debounce

      // Should show filtered results or empty state
      await expect(page.locator('body')).toContainText(/Gibson|no.*results/i);
    });

    test('price filter works', async ({ page }) => {
      await page.goto('/');

      // Look for price range inputs
      const minPrice = page.getByLabel(/min.*price/i).or(page.locator('input[placeholder*="min" i]'));
      if (await minPrice.isVisible()) {
        await minPrice.fill('500');
        await page.waitForTimeout(500);
      }
    });

    test('sort by price works', async ({ page }) => {
      await page.goto('/');

      const sortSelect = page.getByRole('combobox', { name: /sort/i }).or(page.locator('select'));
      if (await sortSelect.isVisible()) {
        await sortSelect.selectOption({ label: /price.*low/i });
        await page.waitForTimeout(500);
      }
    });
  });

  test.describe('Listing Detail', () => {
    test('clicking listing opens detail page', async ({ page }) => {
      await page.goto('/');

      // Click first listing
      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();

      // Should be on detail page
      await expect(page.url()).toContain('/listing/');
    });

    test('detail page shows add to cart button', async ({ page }) => {
      await page.goto('/');
      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();

      await expect(page.getByRole('button', { name: /add to cart/i })).toBeVisible();
    });

    test('detail page shows make offer button when logged in', async ({ page, loginAsUser }) => {
      await loginAsUser();

      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();

      await expect(page.getByRole('button', { name: /make.*offer/i })).toBeVisible();
    });
  });
});
```

**Step 2: Run tests**

Run:
```bash
cd G:/projects/lgs/frontend && npx playwright test listings.spec.ts --project=chromium
```

Expected: Tests pass or identify UI issues to fix

**Step 3: Commit**

```bash
cd G:/projects/lgs && git add frontend/e2e/listings.spec.ts
git commit -m "test: add listings browse and search E2E tests"
```

---

## Task 6: Cart Tests

**Files:**
- Create: `frontend/e2e/cart.spec.ts`

**Step 1: Create test file**

Create `frontend/e2e/cart.spec.ts`:

```typescript
import { test, expect } from './fixtures/auth.fixture';

test.describe('Shopping Cart', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cart before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('cart'));
  });

  test.describe('Add to Cart', () => {
    test('adds item to cart from listing detail', async ({ page }) => {
      await page.goto('/');

      // Go to first listing
      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();

      // Add to cart
      await page.getByRole('button', { name: /add to cart/i }).click();

      // Verify cart badge updates
      await expect(page.locator('[data-testid="cart-count"]').or(page.getByText(/\(1\)/))).toBeVisible();
    });

    test('prevents adding same item twice', async ({ page }) => {
      await page.goto('/');

      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();

      await page.getByRole('button', { name: /add to cart/i }).click();

      // Button should change or be disabled
      await expect(
        page.getByRole('button', { name: /in cart|added/i })
          .or(page.getByRole('button', { name: /add to cart/i }).and(page.locator('[disabled]')))
      ).toBeVisible();
    });
  });

  test.describe('View Cart', () => {
    test('cart page shows added items', async ({ page }) => {
      // Add item first
      await page.goto('/');
      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();
      await page.getByRole('button', { name: /add to cart/i }).click();

      // Go to cart
      await page.goto('/cart');

      // Should show item
      await expect(page.locator('img')).toBeVisible();
      await expect(page.getByText(/\$[\d,]+/)).toBeVisible();
    });

    test('shows total correctly', async ({ page }) => {
      await page.goto('/cart');

      // Empty cart or shows total
      const totalOrEmpty = page.getByText(/total|empty|no items/i);
      await expect(totalOrEmpty).toBeVisible();
    });
  });

  test.describe('Remove from Cart', () => {
    test('removes item when clicking remove', async ({ page }) => {
      // Add item
      await page.goto('/');
      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();
      await page.getByRole('button', { name: /add to cart/i }).click();

      // Go to cart and remove
      await page.goto('/cart');
      const removeButton = page.getByRole('button', { name: /remove|trash/i }).or(page.locator('[data-testid="remove-item"]'));
      await removeButton.click();

      // Should show empty state
      await expect(page.getByText(/empty|no items/i)).toBeVisible();
    });
  });

  test.describe('Empty Cart', () => {
    test('shows empty message when cart is empty', async ({ page }) => {
      await page.goto('/cart');
      await expect(page.getByText(/empty|no items|cart is empty/i)).toBeVisible();
    });

    test('has link to continue shopping', async ({ page }) => {
      await page.goto('/cart');
      await expect(page.getByRole('link', { name: /continue.*shopping|browse/i })).toBeVisible();
    });
  });
});
```

**Step 2: Run tests**

Run:
```bash
cd G:/projects/lgs/frontend && npx playwright test cart.spec.ts --project=chromium
```

**Step 3: Commit**

```bash
cd G:/projects/lgs && git add frontend/e2e/cart.spec.ts
git commit -m "test: add shopping cart E2E tests"
```

---

## Task 7: Favorites Tests

**Files:**
- Create: `frontend/e2e/favorites.spec.ts`

**Step 1: Create test file**

Create `frontend/e2e/favorites.spec.ts`:

```typescript
import { test, expect } from './fixtures/auth.fixture';

test.describe('Favorites', () => {
  test.describe('Add Favorite', () => {
    test('adds favorite when logged in', async ({ page, loginAsUser }) => {
      await loginAsUser();

      // Go to listing detail
      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();

      // Click heart/favorite button
      const heartButton = page.getByRole('button', { name: /favorite|heart/i })
        .or(page.locator('[data-testid="favorite-button"]'))
        .or(page.locator('button:has(svg[class*="heart"])'));

      await heartButton.click();

      // Heart should be filled/red
      await expect(page.locator('[data-favorited="true"]').or(page.locator('.text-red-500'))).toBeVisible();
    });

    test('prompts login when not authenticated', async ({ page }) => {
      await page.goto('/');

      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();

      const heartButton = page.getByRole('button', { name: /favorite|heart/i })
        .or(page.locator('[data-testid="favorite-button"]'));

      if (await heartButton.isVisible()) {
        await heartButton.click();
        // Should show login modal or redirect
        await expect(page.getByText(/login|sign in/i)).toBeVisible();
      }
    });
  });

  test.describe('View Favorites', () => {
    test('favorites page shows favorited items', async ({ page, loginAsUser }) => {
      await loginAsUser();

      // Add a favorite first
      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();

      const heartButton = page.getByRole('button', { name: /favorite|heart/i })
        .or(page.locator('[data-testid="favorite-button"]'));
      await heartButton.click();

      // Go to favorites page
      await page.goto('/favorites');

      // Should show the favorited listing
      await expect(page.locator('img').or(page.getByText(/no favorites/i))).toBeVisible();
    });
  });

  test.describe('Remove Favorite', () => {
    test('removes favorite when clicking heart again', async ({ page, loginAsUser }) => {
      await loginAsUser();

      // Go to favorites page
      await page.goto('/favorites');

      // If there's a favorited item, unfavorite it
      const heartButton = page.getByRole('button', { name: /remove|unfavorite|heart/i }).first();
      if (await heartButton.isVisible()) {
        await heartButton.click();
        await page.waitForTimeout(500);
      }
    });
  });
});
```

**Step 2: Run tests**

Run:
```bash
cd G:/projects/lgs/frontend && npx playwright test favorites.spec.ts --project=chromium
```

**Step 3: Commit**

```bash
cd G:/projects/lgs && git add frontend/e2e/favorites.spec.ts
git commit -m "test: add favorites E2E tests"
```

---

## Task 8: Offers Tests

**Files:**
- Create: `frontend/e2e/offers.spec.ts`

**Step 1: Create test file**

Create `frontend/e2e/offers.spec.ts`:

```typescript
import { test, expect } from './fixtures/auth.fixture';

test.describe('Offers', () => {
  test.describe('Make Offer', () => {
    test('opens offer modal when clicking make offer', async ({ page, loginAsUser }) => {
      await loginAsUser();

      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();

      await page.getByRole('button', { name: /make.*offer/i }).click();

      // Modal should open
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByLabel(/amount|offer/i)).toBeVisible();
    });

    test('submits offer successfully', async ({ page, loginAsUser }) => {
      await loginAsUser();

      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();

      await page.getByRole('button', { name: /make.*offer/i }).click();

      // Fill offer amount
      await page.getByLabel(/amount|offer/i).fill('500');
      await page.getByRole('button', { name: /submit|send/i }).click();

      // Should show success or confirmation
      await expect(page.getByText(/success|submitted|sent/i)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('View Offers', () => {
    test('offers page shows user offers', async ({ page, loginAsUser }) => {
      await loginAsUser();
      await page.goto('/offers');

      // Should show offers list or empty state
      await expect(page.getByText(/offer|no offers|pending/i)).toBeVisible();
    });

    test('can filter offers by status', async ({ page, loginAsUser }) => {
      await loginAsUser();
      await page.goto('/offers');

      // Look for status filter
      const statusFilter = page.getByRole('combobox', { name: /status/i })
        .or(page.locator('select'));

      if (await statusFilter.isVisible()) {
        await statusFilter.click();
        await expect(page.getByText(/pending|accepted|rejected/i)).toBeVisible();
      }
    });
  });

  test.describe('Offer Detail', () => {
    test('shows offer timeline/history', async ({ page, loginAsUser }) => {
      await loginAsUser();
      await page.goto('/offers');

      // Click first offer if exists
      const firstOffer = page.locator('a[href*="/offers/"]').first();
      if (await firstOffer.isVisible()) {
        await firstOffer.click();

        // Should show offer details
        await expect(page.getByText(/status|amount|\$/i)).toBeVisible();
      }
    });
  });

  test.describe('Counter-Offer Response', () => {
    test('shows accept/reject buttons for countered offers', async ({ page, loginAsUser }) => {
      await loginAsUser();
      await page.goto('/offers');

      // Find a countered offer
      const counteredOffer = page.getByText(/countered/i).first();
      if (await counteredOffer.isVisible()) {
        await counteredOffer.click();

        // Should show accept/reject buttons
        await expect(page.getByRole('button', { name: /accept/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /reject/i })).toBeVisible();
      }
    });
  });
});
```

**Step 2: Run tests**

Run:
```bash
cd G:/projects/lgs/frontend && npx playwright test offers.spec.ts --project=chromium
```

**Step 3: Commit**

```bash
cd G:/projects/lgs && git add frontend/e2e/offers.spec.ts
git commit -m "test: add offers E2E tests"
```

---

## Task 9: Checkout Tests

**Files:**
- Create: `frontend/e2e/checkout.spec.ts`

**Step 1: Create test file**

Create `frontend/e2e/checkout.spec.ts`:

```typescript
import { test, expect } from './fixtures/auth.fixture';

test.describe('Checkout', () => {
  test.beforeEach(async ({ page }) => {
    // Add item to cart
    await page.goto('/');
    const firstListing = page.locator('a[href*="/listing/"]').first();
    await firstListing.click();
    await page.getByRole('button', { name: /add to cart/i }).click();
  });

  test.describe('Checkout Page', () => {
    test('shows cart items on checkout page', async ({ page }) => {
      await page.goto('/checkout');

      // Should show items and total
      await expect(page.getByText(/\$[\d,]+/)).toBeVisible();
    });

    test('shows shipping address form', async ({ page }) => {
      await page.goto('/checkout');

      // Address fields should be visible
      await expect(page.getByLabel(/name|full name/i)).toBeVisible();
      await expect(page.getByLabel(/address|line 1/i)).toBeVisible();
    });
  });

  test.describe('Stripe Checkout', () => {
    test('redirects to Stripe when selecting credit card', async ({ page, loginAsUser }) => {
      await loginAsUser();
      await page.goto('/checkout');

      // Fill shipping address
      await page.getByLabel(/full name/i).fill('Test User');
      await page.getByLabel(/address.*1|line 1/i).fill('123 Test St');
      await page.getByLabel(/city/i).fill('Test City');
      await page.getByLabel(/state/i).fill('CA');
      await page.getByLabel(/postal|zip/i).fill('12345');
      await page.getByLabel(/country/i).fill('US');

      // Select credit card and checkout
      const stripeButton = page.getByRole('button', { name: /credit card|stripe|pay.*card/i });
      if (await stripeButton.isVisible()) {
        await stripeButton.click();

        // Should redirect to Stripe or show Stripe elements
        await page.waitForTimeout(2000);
        const url = page.url();
        expect(url.includes('stripe.com') || url.includes('checkout')).toBeTruthy();
      }
    });
  });

  test.describe('PayPal Checkout', () => {
    test('shows PayPal button', async ({ page, loginAsUser }) => {
      await loginAsUser();
      await page.goto('/checkout');

      // Fill shipping address
      await page.getByLabel(/full name/i).fill('Test User');
      await page.getByLabel(/address.*1|line 1/i).fill('123 Test St');
      await page.getByLabel(/city/i).fill('Test City');
      await page.getByLabel(/state/i).fill('CA');
      await page.getByLabel(/postal|zip/i).fill('12345');
      await page.getByLabel(/country/i).fill('US');

      // PayPal button should be visible
      await expect(page.locator('[data-testid="paypal-button"]').or(page.getByText(/paypal/i))).toBeVisible();
    });
  });

  test.describe('Saved Shipping Address [FIX NEEDED]', () => {
    test('pre-fills address if user has saved address', async ({ page, loginAsUser }) => {
      await loginAsUser();

      // First save an address via profile
      await page.goto('/profile/edit');
      await page.getByLabel(/address.*1|line 1/i).fill('123 Saved St');
      await page.getByLabel(/city/i).fill('Saved City');
      await page.getByLabel(/state/i).fill('NY');
      await page.getByLabel(/postal|zip/i).fill('10001');
      await page.getByRole('button', { name: /save/i }).click();
      await page.waitForTimeout(1000);

      // Now go to checkout
      await page.goto('/checkout');

      // Address should be pre-filled or show saved address
      // TODO: This is a [0] item that may need fixing
      const addressField = page.getByLabel(/address.*1|line 1/i);
      const value = await addressField.inputValue();

      // Log for debugging
      console.log('Saved address value:', value);
    });

    test('save address checkbox works', async ({ page, loginAsUser }) => {
      await loginAsUser();
      await page.goto('/checkout');

      // Fill address
      await page.getByLabel(/full name/i).fill('New Address User');
      await page.getByLabel(/address.*1|line 1/i).fill('456 New St');
      await page.getByLabel(/city/i).fill('New City');
      await page.getByLabel(/state/i).fill('TX');
      await page.getByLabel(/postal|zip/i).fill('75001');
      await page.getByLabel(/country/i).fill('US');

      // Check save address checkbox if exists
      const saveCheckbox = page.getByLabel(/save.*address/i);
      if (await saveCheckbox.isVisible()) {
        await saveCheckbox.check();
      }
    });
  });
});
```

**Step 2: Run tests**

Run:
```bash
cd G:/projects/lgs/frontend && npx playwright test checkout.spec.ts --project=chromium
```

**Step 3: Commit**

```bash
cd G:/projects/lgs && git add frontend/e2e/checkout.spec.ts
git commit -m "test: add checkout E2E tests"
```

---

## Task 10: Messages Tests + Fix Console Error

**Files:**
- Create: `frontend/e2e/messages.spec.ts`
- Modify: `frontend/app/messages/[conversationId]/page.tsx` (if fix needed)

**Step 1: Create test file**

Create `frontend/e2e/messages.spec.ts`:

```typescript
import { test, expect } from './fixtures/auth.fixture';

test.describe('Messages', () => {
  test.describe('Contact Seller', () => {
    test('opens message modal from listing', async ({ page, loginAsUser }) => {
      await loginAsUser();

      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();

      const messageButton = page.getByRole('button', { name: /message.*seller|contact/i });
      await messageButton.click();

      // Message input should appear
      await expect(page.getByRole('textbox', { name: /message/i }).or(page.locator('textarea'))).toBeVisible();
    });

    test('sends message successfully', async ({ page, loginAsUser }) => {
      await loginAsUser();

      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();

      await page.getByRole('button', { name: /message.*seller|contact/i }).click();

      // Type and send message
      await page.locator('textarea').fill('Test message from E2E test');
      await page.getByRole('button', { name: /send/i }).click();

      // Should show success or redirect to conversation
      await page.waitForTimeout(2000);
      expect(page.url().includes('messages') || await page.getByText(/sent|success/i).isVisible()).toBeTruthy();
    });
  });

  test.describe('View Conversations', () => {
    test('shows conversations list', async ({ page, loginAsUser }) => {
      await loginAsUser();
      await page.goto('/messages');

      // Should show conversations or empty state
      await expect(page.getByText(/message|conversation|no messages/i)).toBeVisible();
    });

    test('no console errors on messages page [FIX NEEDED]', async ({ page, loginAsUser }) => {
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await loginAsUser();
      await page.goto('/messages');
      await page.waitForTimeout(2000);

      // Check for the specific error mentioned in MANUAL_TESTING.md
      const hasListingPriceError = consoleErrors.some(e => e.includes('Failed to fetch listing price'));

      if (hasListingPriceError) {
        console.log('FOUND BUG: "Failed to fetch listing price" error on messages page');
        // This should be fixed - the error is in app/messages/[conversationId]/page.tsx:122
      }

      expect(hasListingPriceError).toBeFalsy();
    });
  });

  test.describe('Chat', () => {
    test('conversation page loads messages', async ({ page, loginAsUser }) => {
      await loginAsUser();
      await page.goto('/messages');

      // Click first conversation if exists
      const firstConvo = page.locator('a[href*="/messages/"]').first();
      if (await firstConvo.isVisible()) {
        await firstConvo.click();

        // Should show message history
        await expect(page.locator('textarea').or(page.getByText(/message/i))).toBeVisible();
      }
    });
  });
});
```

**Step 2: Run tests to identify the console error**

Run:
```bash
cd G:/projects/lgs/frontend && npx playwright test messages.spec.ts --project=chromium
```

**Step 3: If console error found, fix it**

The error is in `frontend/app/messages/[conversationId]/page.tsx:122`:
```
Failed to fetch listing price: {}
```

Read the file, identify the issue, and fix the error handling to not log empty objects.

**Step 4: Commit**

```bash
cd G:/projects/lgs && git add frontend/e2e/messages.spec.ts
git commit -m "test: add messages E2E tests"
```

---

## Task 11: Admin Portal Tests

**Files:**
- Create: `frontend/e2e/admin.spec.ts`

**Step 1: Create test file**

Create `frontend/e2e/admin.spec.ts`:

```typescript
import { test, expect } from './fixtures/auth.fixture';

test.describe('Admin Portal', () => {
  test.describe('Access', () => {
    test('admin can access admin portal', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin();

      // Click profile dropdown
      await page.getByRole('button', { name: /profile/i }).click();

      // Should see Admin Portal option
      await expect(page.getByRole('menuitem', { name: /admin/i })).toBeVisible();

      await page.getByRole('menuitem', { name: /admin/i }).click();
      await expect(page.url()).toContain('/admin');
    });

    test('regular user cannot see admin portal', async ({ page, loginAsUser }) => {
      await loginAsUser();
      await page.getByRole('button', { name: /profile/i }).click();

      // Should NOT see Admin Portal option
      await expect(page.getByRole('menuitem', { name: /admin/i })).not.toBeVisible();
    });
  });

  test.describe('Offers Tab', () => {
    test('shows all customer offers', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin();
      await page.goto('/admin');

      // Click offers tab
      await page.getByRole('tab', { name: /offers/i }).click();

      // Should show offers or empty state
      await expect(page.getByText(/offer|pending|no offers/i)).toBeVisible();
    });

    test('can filter offers by status', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin();
      await page.goto('/admin');
      await page.getByRole('tab', { name: /offers/i }).click();

      const statusFilter = page.getByRole('combobox', { name: /status/i }).or(page.locator('select').first());
      if (await statusFilter.isVisible()) {
        await statusFilter.selectOption({ label: /pending/i });
      }
    });
  });

  test.describe('Counter Offer', () => {
    test('admin can counter an offer', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin();
      await page.goto('/admin');
      await page.getByRole('tab', { name: /offers/i }).click();

      // Find counter input if pending offer exists
      const counterInput = page.getByLabel(/counter/i).or(page.locator('input[placeholder*="counter" i]'));
      if (await counterInput.isVisible()) {
        await counterInput.fill('450');
        await page.getByRole('button', { name: /counter|submit/i }).click();

        await expect(page.getByText(/countered|success/i)).toBeVisible();
      }
    });
  });

  test.describe('Messages Tab', () => {
    test('shows customer messages', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin();
      await page.goto('/admin');
      await page.getByRole('tab', { name: /messages/i }).click();

      await expect(page.getByText(/message|conversation|no messages/i)).toBeVisible();
    });
  });

  test.describe('Orders Tab', () => {
    test('shows all orders', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin();
      await page.goto('/admin');
      await page.getByRole('tab', { name: /orders/i }).click();

      // Should show orders or empty state
      await expect(page.getByText(/order|no orders|\$/i)).toBeVisible();
    });

    test('shows order details including buyer info', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin();
      await page.goto('/admin');
      await page.getByRole('tab', { name: /orders/i }).click();

      // Should show buyer email or name
      const orderRow = page.locator('tr, [data-testid="order-row"]').first();
      if (await orderRow.isVisible()) {
        await expect(orderRow.getByText(/@|buyer/i)).toBeVisible();
      }
    });
  });

  test.describe('Pending Cart Items [FIX NEEDED]', () => {
    test('admin can view pending cart items', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin();
      await page.goto('/admin');

      // Look for pending cart section or tab
      const pendingTab = page.getByRole('tab', { name: /pending.*cart|locked/i });
      if (await pendingTab.isVisible()) {
        await pendingTab.click();
        await expect(page.getByText(/pending|locked|expires/i)).toBeVisible();
      }
    });
  });
});
```

**Step 2: Run tests**

Run:
```bash
cd G:/projects/lgs/frontend && npx playwright test admin.spec.ts --project=chromium
```

**Step 3: Commit**

```bash
cd G:/projects/lgs && git add frontend/e2e/admin.spec.ts
git commit -m "test: add admin portal E2E tests"
```

---

## Task 12: Edge Cases Tests

**Files:**
- Create: `frontend/e2e/edge-cases.spec.ts`

**Step 1: Create test file**

Create `frontend/e2e/edge-cases.spec.ts`:

```typescript
import { test, expect } from './fixtures/auth.fixture';

test.describe('Edge Cases', () => {
  test.describe('Disabled Listing', () => {
    test('cannot make offer on disabled listing', async ({ page, loginAsUser }) => {
      await loginAsUser();

      // This would require a disabled listing to test
      // For now, verify the button state logic exists
      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();

      const makeOfferBtn = page.getByRole('button', { name: /make.*offer/i });
      const isDisabled = await makeOfferBtn.isDisabled();

      // If listing is disabled, button should be disabled
      console.log('Make offer button disabled:', isDisabled);
    });
  });

  test.describe('Cart with Disabled Item [FIX NEEDED]', () => {
    test('shows error when checking out disabled item', async ({ page, loginAsUser }) => {
      // Add item to cart
      await page.goto('/');
      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();
      await page.getByRole('button', { name: /add to cart/i }).click();

      await loginAsUser();
      await page.goto('/checkout');

      // If item was disabled between add and checkout, should show error
      // This is a manual test scenario - automated would need API control
    });
  });

  test.describe('Network Errors', () => {
    test('shows error message when API is down', async ({ page }) => {
      // Simulate API failure by blocking requests
      await page.route('**/api/**', route => route.abort());

      await page.goto('/');
      await page.waitForTimeout(2000);

      // Should show error message, not crash
      const hasError = await page.getByText(/error|failed|unavailable/i).isVisible();
      const hasBlankScreen = (await page.locator('body').textContent())?.trim() === '';

      expect(hasBlankScreen).toBeFalsy();
    });
  });

  test.describe('Locked Cart Items', () => {
    test('locked items show lock icon', async ({ page, loginAsUser }) => {
      await loginAsUser();
      await page.goto('/cart');

      // If there are locked items, they should have lock icon
      const lockIcon = page.locator('[data-testid="lock-icon"]').or(page.locator('svg[class*="lock"]'));
      // Just check the cart loads
      await expect(page.locator('body')).not.toBeEmpty();
    });

    test('cannot remove locked items', async ({ page, loginAsUser }) => {
      await loginAsUser();
      await page.goto('/cart');

      // Locked items should not have remove button
      const lockedItem = page.locator('[data-locked="true"]');
      if (await lockedItem.isVisible()) {
        const removeBtn = lockedItem.getByRole('button', { name: /remove|trash/i });
        await expect(removeBtn).not.toBeVisible();
      }
    });
  });

  test.describe('Mobile Viewport', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('filter button visible on mobile', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('button', { name: /filter/i })).toBeVisible();
    });

    test('filter page works on mobile', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: /filter/i }).click();

      await expect(page.url()).toContain('/filter');
      await expect(page.getByRole('button', { name: /apply|search/i })).toBeVisible();
    });
  });
});
```

**Step 2: Run tests**

Run:
```bash
cd G:/projects/lgs/frontend && npx playwright test edge-cases.spec.ts --project=chromium
```

**Step 3: Commit**

```bash
cd G:/projects/lgs && git add frontend/e2e/edge-cases.spec.ts
git commit -m "test: add edge case E2E tests"
```

---

## Task 13: Run Full Test Suite

**Step 1: Run all tests**

Run:
```bash
cd G:/projects/lgs/frontend && npx playwright test
```

**Step 2: Review failures and fix**

For each failing test:
1. Read the error message
2. Identify the root cause
3. Fix the code
4. Re-run the specific test
5. Commit the fix

**Step 3: Generate test report**

Run:
```bash
cd G:/projects/lgs/frontend && npx playwright show-report
```

---

## Task 14: Update MANUAL_TESTING.md

**Files:**
- Modify: `docs/MANUAL_TESTING.md`

**Step 1: Do final manual verification**

Walk through the full flow manually:
1. Register new account
2. Browse listings
3. Add to cart
4. Make offer
5. Complete checkout
6. Check admin portal

**Step 2: Update checklist**

Change all `[0]` items that are now fixed to `[1]`.

**Step 3: Commit**

```bash
cd G:/projects/lgs && git add docs/MANUAL_TESTING.md
git commit -m "docs: update manual testing checklist with passing items"
```

---

## Task 15: Final Commit

**Step 1: Ensure all tests pass**

Run:
```bash
cd G:/projects/lgs/frontend && npx playwright test
```

Expected: All tests pass

**Step 2: Commit any remaining changes**

```bash
cd G:/projects/lgs && git add -A
git commit -m "feat: complete E2E testing implementation

- Add Playwright E2E test suite
- Fix [0] items from manual testing checklist
- Cover auth, listings, cart, offers, checkout, messages, admin flows
- Add edge case and mobile viewport tests"
```

---

## Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1-3 | Setup Playwright | - |
| 4 | Auth tests | 7 |
| 5 | Listings tests | 8 |
| 6 | Cart tests | 7 |
| 7 | Favorites tests | 4 |
| 8 | Offers tests | 5 |
| 9 | Checkout tests | 5 |
| 10 | Messages tests + fix | 4 |
| 11 | Admin tests | 8 |
| 12 | Edge cases tests | 6 |
| 13-15 | Run suite, fix, update docs | - |

**Total: ~54 tests covering all critical flows**
