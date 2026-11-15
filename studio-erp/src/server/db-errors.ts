/** Postgres unique_violation (23505), possibly wrapped by drizzle in `cause`. */
export function isUniqueViolation(e: unknown): boolean {
  for (let cur = e as { code?: string; cause?: unknown } | undefined, i = 0; cur && i < 4; cur = cur.cause as typeof cur, i++) {
    if (cur.code === '23505') return true
  }
  return false
}
