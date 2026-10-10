import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url))

/**
 * Integration tests: server modules, Server Actions and Route Handlers against a real
 * PostgreSQL (TEST_DATABASE_URL, migrated and seeded with the demo data before the run).
 * The Next.js request APIs (headers, cookies, after, cache tags, redirects) are replaced
 * by an in-memory request context — see tests/integration/setup/next.ts.
 *   pnpm test:integration
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://sifra:sifra@localhost:5432/sifra_test'

export default defineConfig({
  resolve: {
    alias: {
      '@': src('./src'),
      // the marker throws outside a React Server environment; tests are that environment
      'server-only': src('./node_modules/server-only/empty.js'),
    },
  },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['tests/integration/setup/global.ts'],
    setupFiles: ['tests/integration/setup/next.ts'],
    // one database: files run one after another, so counters and stock stay predictable
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      TZ: 'UTC',
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      DATABASE_POOL_MAX: '4',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
      BETTER_AUTH_SECRET: 'integration-only-secret-not-for-production-0123456789',
      DATA_ENCRYPTION_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
      CRON_SECRET: 'integration-cron-secret',
      STORAGE_DRIVER: 'local',
      STORAGE_DIR: src('./.data/test-storage'),
      ALLOW_SIMULATED_PAYMENTS: 'true',
      MAIL_STAFF: 'staff@test.sifravision.ro',
      SMTP_HOST: '',
      STRIPE_SECRET_KEY: '',
      STRIPE_WEBHOOK_SECRET: '',
      NETOPIA_API_KEY: '',
      SMARTBILL_TOKEN: '',
      DEMO_PASSWORD: 'sifra-demo-2026',
    },
  },
})
