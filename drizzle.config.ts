import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  casing: 'snake_case',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://sifra:sifra@localhost:5432/sifra' },
  strict: true,
  verbose: true,
})
