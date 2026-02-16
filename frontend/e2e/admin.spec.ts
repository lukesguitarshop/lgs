import { test, expect } from './fixtures/auth.fixture';

test.describe('Admin Portal', () => {
  test.describe('Access Control', () => {
    test('shows access denied for unauthenticated users', async ({ page }) => {
      await page.goto('/admin');

      // Should show access denied heading
      await expect(page.getByRole('heading', { name: /access denied/i })).toBeVisible();
    });

    test('shows access denied for non-admin users', async ({ page, loginAsUser }) => {
      await loginAsUser();
      await page.goto('/admin');

      // Should show access denied
      await expect(page.getByRole('heading', { name: /access denied/i })).toBeVisible();
    });

    test('allows access to admin users', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin();
      await page.goto('/admin');

      // Should NOT show access denied (admin gets through)
      await expect(page.getByRole('heading', { name: /access denied/i })).not.toBeVisible();
      // Should show admin dashboard content
      await expect(page.getByRole('heading').first()).toBeVisible();
    });
  });

  test.describe('Admin Dashboard', () => {
    test('shows admin navigation', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin();
      await page.goto('/admin');

      // Should show admin sections/tabs
      await expect(
        page.getByText(/listings|users|orders|analytics|dashboard/i).first()
      ).toBeVisible();
    });

    test('shows listing management', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin();
      await page.goto('/admin');

      // Should have listings section
      await expect(
        page.getByText(/listings|products|inventory/i).first()
      ).toBeVisible();
    });
  });
});
