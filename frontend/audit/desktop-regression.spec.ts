/**
 * Desktop "unchanged" check for the mobile work: full-page screenshots of the
 * admin pages (every Finances sub-tab included) and a few storefront pages at
 * 1440px, compared against a baseline. Record the baseline on the old code with
 * `npm run audit:desktop -- --update-snapshots`, then rerun on the new code.
 */
import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { STATE_FILE, type AuditState } from './setup';

const PAGES: { name: string; url: string; tab?: string }[] = [
  { name: 'home', url: '/' },
  { name: 'cart', url: '/cart' },
  { name: 'admin', url: '/admin' },
  { name: 'admin-other-tools', url: '/admin/other-tools' },
  { name: 'admin-trade-ins', url: '/admin/trade-ins' },
  { name: 'deal-finder', url: '/deal-finder' },
  { name: 'finances-transactions', url: '/finances', tab: 'transactions' },
  { name: 'finances-dashboard', url: '/finances', tab: 'dashboard' },
  { name: 'finances-monthly', url: '/finances', tab: 'monthly' },
  { name: 'finances-expenses', url: '/finances', tab: 'expenses' },
  { name: 'finances-flip-calc', url: '/finances', tab: 'flip-calc' },
];

test.use({ viewport: { width: 1440, height: 900 } });

for (const p of PAGES) {
  test(`desktop ${p.name}`, async ({ page }) => {
    const state: AuditState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const { token, user } = state.sessions.admin;
    await page.addInitScript(([t, u, tab]) => {
      localStorage.setItem('auth_token', t);
      localStorage.setItem('auth_user', u);
      if (tab) localStorage.setItem('adminFinanceTab', tab);
    }, [token, JSON.stringify(user), p.tab ?? ''] as const);
    await page.goto(p.url);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await expect(page).toHaveScreenshot(`${p.name}.png`, {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.002,
      // Live timestamps / relative times would otherwise make every run differ.
      mask: [page.locator('time')],
    });
  });
}
