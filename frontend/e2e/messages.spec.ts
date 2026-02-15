import { test, expect } from './fixtures/auth.fixture';

test.describe('Messages', () => {
  test.describe('Message Seller Button', () => {
    test('message seller button visible on listing detail', async ({ page }) => {
      await page.goto('/');
      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();

      // Message seller button should be visible
      await expect(page.getByRole('button', { name: /message.*seller/i })).toBeVisible();
    });

    test('prompts login when not authenticated', async ({ page }) => {
      await page.goto('/');
      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();

      // Click message seller button
      await page.getByRole('button', { name: /message.*seller/i }).click();

      // Should show login modal
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Messages Page', () => {
    test('messages page accessible when logged in', async ({ page, loginAsUser }) => {
      await loginAsUser();
      await page.goto('/messages');

      // Should show messages page content
      await expect(page.getByRole('heading').first()).toBeVisible();
    });

    test('shows empty state or conversations', async ({ page, loginAsUser }) => {
      await loginAsUser();
      await page.goto('/messages');

      // Should show messages heading (exact match)
      await expect(page.getByRole('heading', { name: 'Messages', exact: true })).toBeVisible();
    });
  });

  test.describe('Start Conversation', () => {
    test('can start conversation from listing', async ({ page, loginAsUser }) => {
      await loginAsUser();

      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();

      // Click message seller button
      await page.getByRole('button', { name: /message.*seller/i }).click();

      // Should navigate to messages page
      await expect(page).toHaveURL(/messages/, { timeout: 10000 });
    });
  });
});
