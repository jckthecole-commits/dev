import 'server-only'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set — copy .env.example to .env')

type Client = ReturnType<typeof postgres>
const g = globalThis as unknown as { __studioPg?: Client }

/** One pool per process (survives HMR in development). */
const client = g.__studioPg ?? postgres(url, { max: Number(process.env.DATABASE_POOL_MAX ?? 10), idle_timeout: 20, connect_timeout: 10, onnotice: () => {} })
if (process.env.NODE_ENV !== 'production') g.__studioPg = client

export const db = drizzle(client, { schema, casing: 'snake_case' })
export type DB = typeof db
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0]
export { schema }
