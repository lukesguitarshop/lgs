import { test, expect, TEST_USER } from './fixtures/auth.fixture';

test.describe('Authentication', () => {
  test.describe('Login Modal', () => {
    test('opens login modal when clicking Sign In', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: /sign in/i }).click();

      // Login modal should be visible
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
      await expect(page.locator('#email')).toBeVisible();
      await expect(page.locator('#password')).toBeVisible();
    });

    test('can switch to registration form', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: /sign in/i }).click();

      // Click "Create one" to switch to register
      await page.getByRole('button', { name: /create one/i }).click();

      // Registration form should be visible
      await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
      await expect(page.locator('#fullName')).toBeVisible();
      await expect(page.locator('#registerEmail')).toBeVisible();
    });

    test('can close modal with close button', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: /sign in/i }).click();

      // Close the modal
      await page.getByRole('button', { name: /close/i }).click();

      // Modal should be closed
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });

  test.describe('Login Flow', () => {
    test('shows error for invalid credentials', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: /sign in/i }).click();

      await page.locator('#email').fill('nonexistent@test.com');
      await page.locator('#password').fill('wrongpassword123');
      await page.getByRole('dialog').getByRole('button', { name: /sign in/i }).click();

      // Should show error message (red error box)
      await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 10000 });
    });

    test('logs in successfully with correct credentials', async ({ page, loginAsUser }) => {
      await loginAsUser();
      // Profile button (User icon) should be visible
      await expect(page.locator('nav button:has(svg)')).toBeVisible();
    });

    test('persists login after page refresh', async ({ page, loginAsUser }) => {
      await loginAsUser();
      await page.reload();
      // Profile button should still be visible after reload
      await expect(page.locator('nav button:has(svg)')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Logout Flow', () => {
    test('logs out and shows sign in button', async ({ page, loginAsUser, logout }) => {
      await loginAsUser();
      await logout();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    });

    test('clears auth token on logout', async ({ page, loginAsUser, logout }) => {
      await loginAsUser();
      await logout();

      const token = await page.evaluate(() => localStorage.getItem('auth_token'));
      expect(token).toBeNull();
    });
  });

  test.describe('Profile Dropdown', () => {
    test('shows profile dropdown with user options', async ({ page, loginAsUser }) => {
      await loginAsUser();

      // Click profile button
      await page.locator('nav button:has(svg)').click();

      // Should show dropdown menu with options
      await expect(page.getByRole('menuitem', { name: /profile/i })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: /sign out/i })).toBeVisible();
    });
  });
});
