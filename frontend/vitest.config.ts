import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Playwright owns ./e2e -- keep vitest off it so the two runners don't
    // try to execute each other's specs.
    include: ['lib/**/*.test.ts'],
    environment: 'node',
  },
});
