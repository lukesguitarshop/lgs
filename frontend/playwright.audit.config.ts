import { defineConfig } from '@playwright/test';

// Mobile layout audit (audit/mobile-audit.spec.ts) and the desktop screenshot
// comparison (audit/desktop-regression.spec.ts). Local stack only: see README.
export default defineConfig({
  testDir: './audit',
  globalSetup: './audit/setup.ts',
  fullyParallel: true,
  workers: process.env.AUDIT_WORKERS ? Number(process.env.AUDIT_WORKERS) : 3,
  retries: 0,
  reporter: [['list'], ['./audit/summary-reporter.ts']],
  outputDir: './mobile-audit/test-results',
  snapshotPathTemplate: './mobile-audit/desktop-baseline/{arg}{ext}',
  use: {
    baseURL: process.env.AUDIT_BASE_URL ?? 'http://localhost:3000',
    actionTimeout: 10000,
    navigationTimeout: 60000,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
