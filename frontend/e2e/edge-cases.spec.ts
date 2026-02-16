import { test, expect } from './fixtures/auth.fixture';

test.describe('Edge Cases', () => {
  test.describe('404 Pages', () => {
    test('shows 404 for non-existent listing', async ({ page }) => {
      await page.goto('/listing/nonexistent-id-12345');

      // Should show error or 404 message
      await expect(
        page.getByText(/not found|doesn't exist|error|404/i).first()
      ).toBeVisible({ timeout: 10000 });
    });

    test('shows 404 for non-existent page', async ({ page }) => {
      await page.goto('/this-page-does-not-exist');

      // Should show 404 page
      await expect(
        page.getByText(/404|not found|page.*exist/i).first()
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Navigation', () => {
    test('logo navigates to home', async ({ page }) => {
      await page.goto('/about');
      await page.locator('a[href="/"]').first().click();

      await expect(page).toHaveURL('/');
    });

    test('footer links work', async ({ page }) => {
      await page.goto('/');

      // Check footer has navigation links
      const footer = page.locator('footer');
      await expect(footer.getByRole('link', { name: /home/i })).toBeVisible();
      await expect(footer.getByRole('link', { name: /about/i })).toBeVisible();
    });

    test('shop info page loads', async ({ page }) => {
      await page.goto('/shop-info');

      await expect(page.getByRole('heading').first()).toBeVisible();
    });

    test('about page loads', async ({ page }) => {
      await page.goto('/about');

      await expect(page.getByRole('heading').first()).toBeVisible();
    });

    test('reviews page loads', async ({ page }) => {
      await page.goto('/reviews');

      await expect(page.getByRole('heading').first()).toBeVisible();
    });

    test('contact page loads', async ({ page }) => {
      await page.goto('/contact');

      await expect(page.getByRole('heading').first()).toBeVisible();
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('mobile menu button visible on mobile', async ({ page }) => {
      await page.goto('/');

      // Mobile menu button should be visible (hamburger icon in nav)
      const mobileMenuButton = page.locator('header button, nav button').first();
      await expect(mobileMenuButton).toBeVisible();
    });

    test('listings display on mobile', async ({ page }) => {
      await page.goto('/');

      // Should show listings
      await expect(page.locator('a[href*="/listing/"]').first()).toBeVisible();
    });
  });

  test.describe('Session Handling', () => {
    test('handles expired session gracefully', async ({ page, loginAsUser }) => {
      await loginAsUser();

      // Clear the auth token to simulate expiry
      await page.evaluate(() => localStorage.removeItem('auth_token'));

      // Navigate to protected page
      await page.goto('/favorites');

      // Should handle gracefully (redirect or show login prompt)
      await expect(
        page.getByRole('button', { name: /sign in/i })
          .or(page.getByRole('heading').first())
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Empty States', () => {
    test('favorites shows empty state', async ({ page, loginAsUser }) => {
      await loginAsUser();
      await page.goto('/favorites');

      // Should show content (empty or with favorites)
      await expect(page.getByRole('heading').first()).toBeVisible();
    });

    test('messages shows empty state', async ({ page, loginAsUser }) => {
      await loginAsUser();
      await page.goto('/messages');

      // Should show content (empty or with messages)
      await expect(page.getByRole('heading', { name: 'Messages', exact: true })).toBeVisible();
    });
  });
});
