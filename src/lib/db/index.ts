import 'server-only'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set — copy .env.example to .env')

type Client = ReturnType<typeof postgres>
const g = globalThis as unknown as { __sifraPg?: Client }

/** One pool per process (survives HMR in development). */
const client =
  g.__sifraPg ??
  postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: process.env.DATABASE_PREPARE !== 'false', // set false behind PgBouncer (transaction mode)
    onnotice: () => {},
  })
if (process.env.NODE_ENV !== 'production') g.__sifraPg = client

export const db = drizzle(client, { schema, casing: 'snake_case' })
export type DB = typeof db
export { schema }
