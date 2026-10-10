/**
 * The in-memory request every Server Action / server module sees during a test:
 * headers(), cookies(), after() and the cache/redirect calls read and write this.
 * Reset before each test by tests/integration/setup/next.ts.
 */
export type CookieOptions = { httpOnly?: boolean; secure?: boolean; sameSite?: string | boolean; path?: string; maxAge?: number; expires?: Date; domain?: string }
export type SetCookie = { name: string; value: string; options: CookieOptions }

let ipCounter = 0
const nextIp = () => {
  ipCounter++
  return `10.77.${(ipCounter >> 8) & 255}.${ipCounter & 255}`
}

export const request = {
  /** request headers other than `cookie` (lower-case names) */
  headers: new Map<string, string>(),
  /** the cookie jar (what the browser would send) */
  cookies: new Map<string, string>(),
  /** every cookies().set/delete call, in order — assert flags like `secure` here */
  setCookies: [] as SetCookie[],
  /** callbacks handed to after(); run them with flushAfter() */
  after: [] as Array<() => unknown>,
  /** updateTag / revalidateTag / revalidatePath / refresh calls */
  revalidated: [] as string[],
  /** mails "sent" through @/server/mail */
  mails: [] as Array<{ to: string; subject: string; html: string; text?: string; replyTo?: string; attachments?: unknown[] }>,
}

/** A fresh anonymous visitor with its own client IP (so rate limits never leak between tests). */
export function resetRequest() {
  request.headers = new Map([
    ['x-client-ip', nextIp()],
    ['user-agent', 'vitest-integration'],
    ['host', 'localhost:3000'],
    ['origin', 'http://localhost:3000'],
  ])
  request.cookies = new Map()
  request.setCookies = []
  request.after = []
  request.revalidated = []
  request.mails = []
}
resetRequest()

/** Switch to a new client IP (e.g. to exercise a rate limit from a second visitor). */
export function newClientIp(ip?: string) {
  request.headers.set('x-client-ip', ip ?? nextIp())
  return request.headers.get('x-client-ip')!
}

export function setHeader(name: string, value: string | null) {
  if (value === null) request.headers.delete(name.toLowerCase())
  else request.headers.set(name.toLowerCase(), value)
}

export function buildHeaders(): Headers {
  const h = new Headers()
  for (const [k, v] of request.headers) h.set(k, v)
  if (request.cookies.size) h.set('cookie', [...request.cookies].map(([k, v]) => `${k}=${v}`).join('; '))
  return h
}

/** Run (and clear) everything scheduled with after(); errors are returned, not thrown. */
export async function flushAfter(): Promise<unknown[]> {
  const errors: unknown[] = []
  while (request.after.length) {
    const cbs = request.after.splice(0)
    for (const cb of cbs) {
      try {
        await cb()
      } catch (e) {
        errors.push(e)
      }
    }
  }
  return errors
}
