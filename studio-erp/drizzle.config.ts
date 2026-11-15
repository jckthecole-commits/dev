import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  casing: 'snake_case',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://studio:studio@localhost:5432/studio' },
  strict: true,
})
