import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests against a running app with the demo seed
 * (`pnpm db:reset` or `pnpm db:seed` with SEED_DEMO=1).
 * Locally: `pnpm dev` in another terminal, then `pnpm e2e`.
 * CI: builds and starts the production server via `webServer`.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    locale: 'ro-RO',
    timezoneId: 'Europe/Bucharest',
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: process.env.CI ? 'pnpm start' : 'pnpm dev', url: baseURL, reuseExistingServer: true, timeout: 180_000 },
})
