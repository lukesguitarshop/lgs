import { test as base, expect } from '@playwright/test';

// Test user credentials
export const TEST_USER = {
  email: 'testuser@lgs.com',
  password: 'TestPassword123!',
  fullName: 'Test User',
};

export const TEST_ADMIN = {
  email: 'testadmin@lgs.com',
  password: 'TestPassword123!',
  fullName: 'Test Admin',
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
      // Click "Sign In" button to open login modal
      await page.getByRole('button', { name: /sign in/i }).click();
      // Fill login form in modal
      await page.locator('#email').fill(TEST_USER.email);
      await page.locator('#password').fill(TEST_USER.password);
      // Submit form
      await page.getByRole('button', { name: /sign in/i }).click();
      // Wait for profile button (User icon) to appear
      await expect(page.locator('nav button:has(svg)')).toBeVisible({ timeout: 10000 });
    };
    await use(login);
  },

  loginAsAdmin: async ({ page }, use) => {
    const login = async () => {
      await page.goto('/');
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.locator('#email').fill(TEST_ADMIN.email);
      await page.locator('#password').fill(TEST_ADMIN.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      // Wait for profile button (User icon) to appear
      await expect(page.locator('nav button:has(svg)')).toBeVisible({ timeout: 10000 });
    };
    await use(login);
  },

  logout: async ({ page }, use) => {
    const logout = async () => {
      // Click profile button (User icon)
      await page.locator('nav button:has(svg)').click();
      // Click Sign Out
      await page.getByRole('menuitem', { name: /sign out/i }).click();
      // Wait for Sign In button to reappear
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    };
    await use(logout);
  },
});

export { expect };
