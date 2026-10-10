/**
 * Shared helpers for integration tests. Typical use:
 *
 *   import { actAs, createUser, uid, request, flushAfter, expectRedirect } from '../helpers'
 *   const u = await createUser({ role: 'customer' })
 *   await actAs(u)                    // a real Better Auth session cookie in the request
 *   const r = await someServerAction(formData)
 */
import { randomUUID } from 'node:crypto'
import { hashPassword } from 'better-auth/crypto'
import { eq } from 'drizzle-orm'
import { expect } from 'vitest'
import { db } from '@/lib/db'
import { account, inventory as inventoryTable, location as locationTable, product as productTable, user, variant as variantTable } from '@/lib/db/schema'
import { auth } from '@/server/auth'
import type { Role } from '@/server/session'
import { NextHttpError, NextRedirect } from './next-errors'
import { request } from './request'

export { request, resetRequest, newClientIp, setHeader, buildHeaders, flushAfter } from './request'
export { NextRedirect, NextHttpError } from './next-errors'
export { db }

export const DEMO_PASSWORD = 'sifra-demo-2026'
export const TEST_PASSWORD = 'integration-pass-2026'
/** Users created by the demo seed (password DEMO_PASSWORD). Prefer createUser() for anything you mutate. */
export const DEMO = {
  admin: 'admin@sifravision.ro',
  optometrist: 'optometrist@sifravision.ro',
  staff: 'showroom@sifravision.ro',
  partner: 'partener@example.com',
  customer: 'client@example.com',
} as const

let n = 0
/** A value unique to this run and call: uid('mail') → "mail-lk2j3-1-ab12". */
export const uid = (prefix = 't') => `${prefix}-${Date.now().toString(36)}-${++n}-${randomUUID().slice(0, 4)}`
export const uniqueEmail = (prefix = 'qa') => `${uid(prefix)}@example.com`

let hashed: Promise<string> | null = null

export type TestUser = { id: string; email: string; name: string; role: Role; password: string }

/** A fresh user with a credential account (password TEST_PASSWORD). */
export async function createUser(opts: { role?: Role; email?: string; name?: string; phone?: string | null } = {}): Promise<TestUser> {
  hashed ??= hashPassword(TEST_PASSWORD)
  const id = randomUUID()
  const email = (opts.email ?? uniqueEmail(opts.role ?? 'customer')).toLowerCase()
  const name = opts.name ?? `QA ${opts.role ?? 'customer'}`
  await db.insert(user).values({ id, email, name, role: opts.role ?? 'customer', emailVerified: true, phone: opts.phone ?? null })
  await db.insert(account).values({ id: randomUUID(), accountId: id, providerId: 'credential', userId: id, password: await hashed })
  return { id, email, name, role: opts.role ?? 'customer', password: TEST_PASSWORD }
}

/** The demo user for a seeded e-mail (see DEMO). */
export async function demoUser(email: string): Promise<TestUser> {
  const u = await db.query.user.findFirst({ where: eq(user.email, email) })
  if (!u) throw new Error(`demo user ${email} missing — is the test database seeded?`)
  return { id: u.id, email: u.email, name: u.name, role: (u.role ?? 'customer') as Role, password: DEMO_PASSWORD }
}

/**
 * Signs in for real (Better Auth, e-mail + password) and keeps the session cookie in the
 * request, so getCurrentUser()/requireStaff() see this user. actAs(null) signs out.
 */
export async function actAs(who: TestUser | string | null): Promise<void> {
  for (const k of [...request.cookies.keys()]) if (k.startsWith('sv.') || k.startsWith('__Secure-sv.')) request.cookies.delete(k)
  if (!who) return
  const u = typeof who === 'string' ? await demoUser(who) : who
  const res = await auth.api.signInEmail({ body: { email: u.email, password: u.password }, asResponse: true })
  if (!res.ok) throw new Error(`sign-in failed for ${u.email}: ${res.status} ${await res.text()}`)
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(';')
    const i = pair!.indexOf('=')
    const name = pair!.slice(0, i).trim()
    const value = pair!.slice(i + 1).trim()
    if (/max-age=0/i.test(line) || !value) request.cookies.delete(name)
    else request.cookies.set(name, value)
  }
  if (![...request.cookies.keys()].some((k) => k.endsWith('session_token'))) throw new Error('no session cookie after sign-in')
}

/** Shorthand: a fresh user of a role, signed in. */
export async function signedInAs(role: Role = 'customer') {
  const u = await createUser({ role })
  await actAs(u)
  return u
}

/** FormData from a plain object (arrays become repeated fields, objects become JSON). */
export function form(fields: Record<string, unknown>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue
    if (Array.isArray(v)) for (const x of v) fd.append(k, x instanceof Blob ? x : String(x))
    else if (v instanceof Blob) fd.append(k, v)
    else if (typeof v === 'object') fd.append(k, JSON.stringify(v))
    else fd.append(k, String(v))
  }
  return fd
}

/** Awaits a call that must redirect; returns the target URL. */
export async function expectRedirect(p: Promise<unknown> | (() => unknown), to?: string | RegExp): Promise<string> {
  let err: unknown
  try {
    await (typeof p === 'function' ? p() : p)
  } catch (e) {
    err = e
  }
  expect(err, 'expected a redirect').toBeInstanceOf(NextRedirect)
  const url = (err as NextRedirect).url
  if (typeof to === 'string') expect(url).toBe(to)
  else if (to) expect(url).toMatch(to)
  return url
}

/** Awaits a call that must end in forbidden() / notFound() / unauthorized(). */
export async function expectHttpError(p: Promise<unknown> | (() => unknown), status: 401 | 403 | 404) {
  let err: unknown
  try {
    await (typeof p === 'function' ? p() : p)
  } catch (e) {
    err = e
  }
  expect(err, `expected HTTP ${status}`).toBeInstanceOf(NextHttpError)
  expect((err as NextHttpError).status).toBe(status)
}

/** A Request for a Route Handler, with the current request's headers and cookies. */
export function routeRequest(path: string, init: RequestInit & { json?: unknown } = {}): Request {
  const h = new Headers()
  for (const [k, v] of request.headers) h.set(k, v)
  if (request.cookies.size) h.set('cookie', [...request.cookies].map(([k, v]) => `${k}=${v}`).join('; '))
  for (const [k, v] of new Headers(init.headers)) h.set(k, v)
  let body = init.body
  if (init.json !== undefined) {
    body = JSON.stringify(init.json)
    h.set('content-type', 'application/json')
  }
  const { json: _json, ...rest } = init
  return new Request(new URL(path, 'http://localhost:3000'), { ...rest, headers: h, body })
}

export type TestProduct = {
  product: typeof productTable.$inferSelect
  variant: typeof variantTable.$inferSelect
  locations: Array<{ id: string; code: string; kind: string; sellable: boolean }>
}

/**
 * A fresh active product (cloned from a seeded frame, so geometry and copy are valid) with
 * one variant and `stock` units at every location (or per location code via `stockAt`).
 * Use it for anything that changes stock, prices or status — never mutate seeded products.
 */
export async function createProduct(
  opts: { category?: 'optical' | 'sun'; price?: number; status?: 'active' | 'draft' | 'archived'; stock?: number; stockAt?: Record<string, number>; priceDelta?: number; wholesalePrice?: number | null; vatClass?: 'standard' | 'reduced' | 'exempt' } = {},
): Promise<TestProduct> {
  const category = opts.category ?? 'optical'
  const base = await db.query.product.findFirst({ where: (p, { and, eq }) => and(eq(p.category, category), eq(p.status, 'active')) })
  if (!base) throw new Error(`no seeded ${category} product to clone`)
  const baseVariant = await db.query.variant.findFirst({ where: (v, { eq }) => eq(v.productId, base.id) })
  const key = uid('qa')
  const { id: _id, createdAt: _c, updatedAt: _u, ...fields } = base
  const [p] = await db
    .insert(productTable)
    .values({
      ...fields,
      slug: key,
      modelCode: key.toUpperCase(),
      name: `QA ${key}`,
      family: `QA ${key}`,
      status: opts.status ?? 'active',
      price: opts.price ?? base.price,
      wholesalePrice: opts.wholesalePrice === undefined ? base.wholesalePrice : opts.wholesalePrice,
      vatClass: opts.vatClass ?? base.vatClass,
      searchText: `qa ${key}`,
      featured: false,
      publishedAt: new Date(),
    })
    .returning()
  const [v] = await db
    .insert(variantTable)
    .values({ productId: p!.id, sku: `SKU-${key}`, colorName: 'Negru QA', colorSlug: 'negru-qa', colorFamily: 'negru', swatch: baseVariant!.swatch, priceDelta: opts.priceDelta ?? 0, isDefault: true, active: true })
    .returning()
  const locations = await db.select({ id: locationTable.id, code: locationTable.code, kind: locationTable.kind, sellable: locationTable.sellable }).from(locationTable)
  for (const l of locations) {
    const onHand = opts.stockAt ? (opts.stockAt[l.code] ?? 0) : (opts.stock ?? 5)
    await db.insert(inventoryTable).values({ variantId: v!.id, locationId: l.id, onHand, reserved: 0 })
  }
  return { product: p!, variant: v!, locations }
}
