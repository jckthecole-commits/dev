import 'server-only'
import { sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { CLIENT_IP_HEADER } from '@/lib/client-ip'
import { db } from '@/lib/db'

/**
 * Fixed-window rate limiter backed by Postgres (works across instances).
 * Returns true when the action is allowed.
 */
export async function rateLimit(bucket: string, limit: number, windowSec: number): Promise<boolean> {
  const h = await headers()
  const ip = h.get(CLIENT_IP_HEADER) ?? 'unknown'
  const key = `${bucket}:${ip}`
  const rows = await db.execute<{ count: number }>(sql`
    insert into rate_limit (key, count, reset_at) values (${key}, 1, now() + make_interval(secs => ${windowSec}))
    on conflict (key) do update set
      count = case when rate_limit.reset_at < now() then 1 else rate_limit.count + 1 end,
      reset_at = case when rate_limit.reset_at < now() then now() + make_interval(secs => ${windowSec}) else rate_limit.reset_at end
    returning count`)
  const count = Number(rows[0]?.count ?? 0)
  return count <= limit
}
