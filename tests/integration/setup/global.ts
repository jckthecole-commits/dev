import { execFileSync } from 'node:child_process'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

/** Creates the test database when missing, applies the migrations and the demo seed (idempotent). */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgres://sifra:sifra@localhost:5432/sifra_test'
  const name = new URL(url).pathname.slice(1)
  const admin = postgres(url.replace(/\/[^/?]+(\?|$)/, '/postgres$1'), { max: 1, onnotice: () => {} })
  try {
    const [row] = await admin`select 1 as ok from pg_database where datname = ${name}`
    if (!row) await admin.unsafe(`create database "${name.replace(/"/g, '')}"`)
  } finally {
    await admin.end()
  }
  const client = postgres(url, { max: 1, onnotice: () => {} })
  try {
    await migrate(drizzle(client), { migrationsFolder: './drizzle' })
  } finally {
    await client.end()
  }
  execFileSync('pnpm', ['exec', 'tsx', 'scripts/seed.ts', '--demo'], {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: url, DEMO_PASSWORD: 'sifra-demo-2026' },
  })
}
