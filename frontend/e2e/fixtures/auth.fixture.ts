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
