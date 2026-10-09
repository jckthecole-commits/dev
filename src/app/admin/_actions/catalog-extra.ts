'use server'

import { eq } from 'drizzle-orm'
import { refresh, updateTag } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { coupon, lensIndex, lensTreatment, lensType, review } from '@/lib/db/schema'
import { zonedToUtc } from '@/lib/time'
import { audit } from '@/server/audit'
import { requireStaff } from '@/server/session'

type R = { ok: boolean; message?: string; error?: string; fieldErrors?: Record<string, string> }
const bani = (lei: number) => Math.round(lei * 100)
const errorsOf = (e: z.ZodError) => Object.fromEntries(e.issues.map((i) => [String(i.path.join('.') || 'formular'), i.message]))

/* ── Lenses ─────────────────────────────────────────────────────────────── */

const lensRow = z.object({
  name: z.string().trim().min(2).max(60),
  summary: z.string().trim().min(2).max(200),
  price: z.coerce.number().min(0).max(20000),
  position: z.coerce.number().int().min(0).max(999),
  active: z.literal('on').optional(),
})
const TABLES = { type: lensType, index: lensIndex, treatment: lensTreatment } as const

export async function saveLensRow(kind: keyof typeof TABLES, id: string, _: unknown, fd: FormData): Promise<R> {
  const me = await requireStaff('catalog:write')
  const d = lensRow.safeParse(Object.fromEntries(fd))
  if (!d.success) return { ok: false, error: 'Verifică valorile.', fieldErrors: errorsOf(d.error) }
  const t = TABLES[kind]
  if (!t) return { ok: false, error: 'Tip invalid.' }
  await db.update(t).set({ name: d.data.name, summary: d.data.summary, price: bani(d.data.price), position: d.data.position, active: d.data.active === 'on', updatedAt: new Date() }).where(eq(t.id, id))
  await audit(me, `lens.${kind}.update`, `lens_${kind}`, id, { price: bani(d.data.price), active: d.data.active === 'on' })
  updateTag('lenses')
  refresh()
  return { ok: true, message: 'Salvat — configuratorul folosește noul preț.' }
}

/* ── Coupons ────────────────────────────────────────────────────────────── */

const couponInput = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,32}$/, '3–32 caractere: litere, cifre, - și _'),
    description: z.string().trim().max(140).optional(),
    kind: z.enum(['percent', 'fixed', 'free_shipping']),
    value: z.coerce.number().min(0).max(100000),
    minSubtotal: z.coerce.number().min(0).max(100000),
    appliesTo: z.enum(['all', 'frames', 'lenses']),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
    usageLimit: z.union([z.literal('').transform(() => null), z.coerce.number().int().min(1)]).optional(),
    active: z.literal('on').optional(),
  })
  .refine((c) => c.kind !== 'percent' || (c.value > 0 && c.value <= 90), { message: 'Procent între 1 și 90', path: ['value'] })
  .refine((c) => c.kind !== 'fixed' || c.value > 0, { message: 'Valoarea reducerii', path: ['value'] })
  .refine((c) => !c.startsAt || !c.endsAt || c.startsAt <= c.endsAt, { message: 'Data de final e înainte de început', path: ['endsAt'] })

export async function saveCoupon(id: string | null, _: unknown, fd: FormData): Promise<R> {
  const me = await requireStaff('catalog:write')
  const d = couponInput.safeParse(Object.fromEntries(fd))
  if (!d.success) return { ok: false, error: 'Verifică valorile.', fieldErrors: errorsOf(d.error) }
  const c = d.data
  const values = {
    code: c.code,
    description: c.description || null,
    kind: c.kind,
    value: c.kind === 'percent' ? Math.round(c.value) : c.kind === 'fixed' ? bani(c.value) : 0,
    minSubtotal: bani(c.minSubtotal),
    appliesTo: c.appliesTo,
    startsAt: c.startsAt ? zonedToUtc(c.startsAt, '00:00') : null,
    endsAt: c.endsAt ? new Date(zonedToUtc(c.endsAt, '23:59').getTime() + 59_999) : null,
    usageLimit: c.usageLimit ?? null,
    active: c.active === 'on',
    updatedAt: new Date(),
  }
  const clash = await db.query.coupon.findFirst({ where: eq(coupon.code, c.code) })
  if (clash && clash.id !== id) return { ok: false, error: `Codul ${c.code} există deja.`, fieldErrors: { code: 'Cod deja folosit' } }
  if (id) await db.update(coupon).set(values).where(eq(coupon.id, id))
  else await db.insert(coupon).values(values)
  await audit(me, id ? 'coupon.update' : 'coupon.create', 'coupon', id ?? c.code, values)
  refresh()
  return { ok: true, message: id ? 'Cupon actualizat.' : `Cuponul ${c.code} a fost creat.` }
}

export async function toggleCoupon(id: string, active: boolean): Promise<R> {
  const me = await requireStaff('catalog:write')
  await db.update(coupon).set({ active, updatedAt: new Date() }).where(eq(coupon.id, id))
  await audit(me, 'coupon.toggle', 'coupon', id, { active })
  refresh()
  return { ok: true }
}

/* ── Reviews ────────────────────────────────────────────────────────────── */

export async function moderateReview(id: string, status: 'approved' | 'rejected' | 'pending'): Promise<R> {
  const me = await requireStaff('content:write')
  const [r] = await db.update(review).set({ status, updatedAt: new Date() }).where(eq(review.id, id)).returning({ productId: review.productId })
  if (!r) return { ok: false, error: 'Recenzia nu există.' }
  await audit(me, `review.${status}`, 'review', id)
  updateTag('reviews')
  updateTag(`reviews:${r.productId}`)
  refresh()
  return { ok: true, message: status === 'approved' ? 'Publicată.' : status === 'rejected' ? 'Respinsă.' : 'Readusă în așteptare.' }
}

export async function replyReview(id: string, _: unknown, fd: FormData): Promise<R> {
  const me = await requireStaff('content:write')
  const reply = String(fd.get('reply') ?? '').trim().slice(0, 1500)
  const [r] = await db.update(review).set({ reply: reply || null, updatedAt: new Date() }).where(eq(review.id, id)).returning({ productId: review.productId })
  if (!r) return { ok: false, error: 'Recenzia nu există.' }
  await audit(me, 'review.reply', 'review', id)
  updateTag(`reviews:${r.productId}`)
  refresh()
  return { ok: true, message: reply ? 'Răspuns publicat.' : 'Răspuns șters.' }
}
