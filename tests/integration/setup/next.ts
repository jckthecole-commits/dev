/**
 * Replaces the Next.js request-scoped APIs with the in-memory request in
 * tests/integration/helpers/request.ts. Applied to every integration test file.
 */
import { afterAll, beforeEach, vi } from 'vitest'
import { resetRequest } from '../helpers/request'

vi.mock('next/headers', async () => {
  const { request, buildHeaders } = await import('../helpers/request')
  const jar = () => ({
    get: (name: string) => (request.cookies.has(name) ? { name, value: request.cookies.get(name)! } : undefined),
    getAll: (name?: string) => [...request.cookies].filter(([k]) => !name || k === name).map(([k, v]) => ({ name: k, value: v })),
    has: (name: string) => request.cookies.has(name),
    set: (...args: unknown[]) => {
      const [a, b, c] = args as [string | { name: string; value: string } & Record<string, unknown>, string?, Record<string, unknown>?]
      const name = typeof a === 'string' ? a : a.name
      const value = typeof a === 'string' ? String(b ?? '') : a.value
      const options = (typeof a === 'string' ? (c ?? {}) : a) as Record<string, unknown>
      request.setCookies.push({ name, value, options })
      if (options.maxAge === 0 || (options.expires instanceof Date && options.expires.getTime() <= Date.now())) request.cookies.delete(name)
      else request.cookies.set(name, value)
    },
    delete: (name: string | { name: string }) => {
      const n = typeof name === 'string' ? name : name.name
      request.setCookies.push({ name: n, value: '', options: { maxAge: 0 } })
      request.cookies.delete(n)
    },
    toString: () => [...request.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
  })
  return {
    headers: async () => buildHeaders(),
    cookies: async () => jar(),
    draftMode: async () => ({ isEnabled: false, enable() {}, disable() {} }),
  }
})

vi.mock('next/cache', async () => {
  const { request } = await import('../helpers/request')
  return {
    cacheLife: () => {},
    cacheTag: () => {},
    unstable_cacheLife: () => {},
    unstable_cacheTag: () => {},
    refresh: () => void request.revalidated.push('refresh'),
    updateTag: (tag: string) => void request.revalidated.push(`tag:${tag}`),
    revalidateTag: (tag: string) => void request.revalidated.push(`tag:${tag}`),
    revalidatePath: (path: string) => void request.revalidated.push(`path:${path}`),
    unstable_noStore: () => {},
    unstable_cache: <T,>(fn: T) => fn,
  }
})

vi.mock('next/server', async (importActual) => {
  const actual = await importActual<typeof import('next/server')>()
  const { request } = await import('../helpers/request')
  return {
    ...actual,
    after: (task: (() => unknown) | Promise<unknown>) => void request.after.push(typeof task === 'function' ? task : () => task),
    connection: async () => {},
  }
})

vi.mock('next/navigation', async () => {
  const { NextRedirect, NextHttpError } = await import('../helpers/next-errors')
  return {
    redirect: (url: string) => {
      throw new NextRedirect(url)
    },
    permanentRedirect: (url: string) => {
      throw new NextRedirect(url, true)
    },
    notFound: () => {
      throw new NextHttpError(404)
    },
    forbidden: () => {
      throw new NextHttpError(403)
    },
    unauthorized: () => {
      throw new NextHttpError(401)
    },
    RedirectType: { push: 'push', replace: 'replace' },
  }
})

// mail is recorded, never written or sent (import the real module with vi.importActual to test it)
vi.mock('@/server/mail', async () => {
  const { request } = await import('../helpers/request')
  return {
    sendMail: async (mail: (typeof request.mails)[number]) => {
      request.mails.push(mail)
      return true
    },
    staffInbox: () => process.env.MAIL_STAFF || null,
  }
})

beforeEach(() => resetRequest())

afterAll(async () => {
  // let the worker exit: close the shared postgres.js pool
  const g = globalThis as unknown as { __sifraPg?: { end: (o?: { timeout?: number }) => Promise<void> } }
  await g.__sifraPg?.end({ timeout: 1 }).catch(() => {})
  delete g.__sifraPg
})
