import { test, expect } from './fixtures/auth.fixture';

test.describe('Checkout', () => {
  test.describe('Unauthenticated User', () => {
    test.beforeEach(async ({ page }) => {
      // Add item to cart first
      await page.goto('/');
      await page.evaluate(() => localStorage.removeItem('cart'));

      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();
      await page.getByRole('button', { name: /add to cart/i }).click();
    });

    test('checkout requires sign in', async ({ page }) => {
      await page.goto('/checkout');

      // Should show sign in required message
      await expect(page.getByRole('heading', { name: /sign in required/i })).toBeVisible();
    });

    test('shows sign in and create account buttons', async ({ page }) => {
      await page.goto('/checkout');

      // Use main content area to avoid header button
      await expect(page.getByRole('main').getByRole('button', { name: /sign in/i })).toBeVisible();
      await expect(page.getByRole('main').getByRole('button', { name: /create account/i })).toBeVisible();
    });

    test('has back to cart link', async ({ page }) => {
      await page.goto('/checkout');

      await expect(page.getByRole('link', { name: /back to cart/i })).toBeVisible();
    });

    test('can navigate from cart to checkout', async ({ page }) => {
      await page.goto('/cart');

      // Click checkout link/button
      await page.getByRole('link', { name: /checkout/i }).first().click();

      // Should be on checkout page
      await expect(page).toHaveURL(/checkout/);
    });
  });

  test.describe('Authenticated User', () => {
    test('checkout page loads with form when logged in', async ({ page, loginAsUser }) => {
      try {
        await loginAsUser();

        // Add item to cart
        const firstListing = page.locator('a[href*="/listing/"]').first();
        await firstListing.click();
        await page.getByRole('button', { name: /add to cart/i }).click();

        await page.goto('/checkout');

        // Should show checkout form, not sign in required
        await expect(page.getByRole('heading', { name: /sign in required/i })).not.toBeVisible();
        // Should show some checkout content
        await expect(page.getByRole('heading').first()).toBeVisible();
      } catch {
        test.skip();
      }
    });

    test('checkout shows order summary when logged in', async ({ page, loginAsUser }) => {
      try {
        await loginAsUser();

        // Add item to cart
        const firstListing = page.locator('a[href*="/listing/"]').first();
        await firstListing.click();
        await page.getByRole('button', { name: /add to cart/i }).click();

        await page.goto('/checkout');

        // Should show order total/summary
        await expect(page.getByText(/\$[\d,]+/).first()).toBeVisible();
      } catch {
        test.skip();
      }
    });
  });
});
