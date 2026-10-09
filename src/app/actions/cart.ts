'use server'

import { and, eq } from 'drizzle-orm'
import { refresh } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { cart, cartItem, coupon, prescription, product, variant } from '@/lib/db/schema'
import { encryptJson } from '@/lib/crypto'
import { validateRx, type RxValues } from '@/lib/optics'
import { couponProblem, normalizeConfiguration, priceConfiguration } from '@/lib/pricing'
import { getLensCatalog } from '@/server/catalog'
import { ensureCartId, getCartId, loadCart } from '@/server/cart'
import { rateLimit } from '@/server/rate-limit'
import { getCurrentUser } from '@/server/session'
import { getSettings } from '@/server/settings'
import { storePrivateFile } from '@/server/storage'

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> }

const eye = z.object({ sph: z.number(), cyl: z.number(), axis: z.number().int().nullable(), add: z.number().nullable() })
const rxSchema = z.object({
  od: eye,
  os: eye,
  pd: z.union([z.object({ mode: z.literal('single'), value: z.number() }), z.object({ mode: z.literal('dual'), right: z.number(), left: z.number() }), z.object({ mode: z.literal('unknown') })]),
  notes: z.string().max(500).optional(),
})
const configSchema = z.object({
  lensType: z.string().max(32),
  lensIndex: z.string().max(8).optional(),
  treatments: z.array(z.string().max(32)).max(10),
  rxMode: z.enum(['manual', 'upload', 'later', 'saved']).optional(),
  prescriptionId: z.uuid().optional(),
  notes: z.string().max(500).optional(),
})

/**
 * Add a configured frame to the cart. Accepts FormData so a prescription photo
 * can be uploaded in the same request:
 *   variantId, config (JSON), rx (JSON, when rxMode=manual), rxFile (File, when rxMode=upload)
 */
export async function addToCart(formData: FormData): Promise<ActionResult<{ count: number }>> {
  if (!(await rateLimit('cart:add', 40, 60))) return { ok: false, error: 'Prea multe cereri. Încearcă din nou peste un minut.' }
  const variantId = String(formData.get('variantId') ?? '')
  let config: z.infer<typeof configSchema>
  try {
    config = configSchema.parse(JSON.parse(String(formData.get('config') ?? '{}')))
  } catch {
    return { ok: false, error: 'Configurație invalidă.' }
  }

  const row = await db
    .select({ v: variant, p: product })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .where(and(eq(variant.id, variantId), eq(variant.active, true), eq(product.status, 'active')))
    .limit(1)
  const found = row[0]
  if (!found) return { ok: false, error: 'Produsul nu mai este disponibil.' }
  const { v, p } = found

  const [lenses, settings, user] = await Promise.all([getLensCatalog(), getSettings(), getCurrentUser()])
  const frame = { name: p.name, variantName: v.colorName, price: p.price + v.priceDelta, category: p.category, lensHeight: p.lensHeight, rim: p.rim, vatClass: p.vatClass }
  const normalized = normalizeConfiguration(frame, config, lenses)
  const type = lenses.types.find((t) => t.code === normalized.lensType)

  // Prescription handling
  if (type?.requiresPrescription) {
    const mode = config.rxMode
    if (!mode) return { ok: false, error: 'Spune-ne cum ne trimiți rețeta.' }
    if (mode === 'manual') {
      let rx: RxValues
      try {
        rx = rxSchema.parse(JSON.parse(String(formData.get('rx') ?? 'null')))
      } catch {
        return { ok: false, error: 'Completează valorile rețetei.' }
      }
      const issues = validateRx(rx, { requiresAdd: type.requiresAdd }).filter((i) => i.level === 'error')
      if (issues.length) return { ok: false, error: issues[0]!.message, fieldErrors: Object.fromEntries(issues.map((i) => [i.field, i.message])) }
      const [rec] = await db.insert(prescription).values({ userId: user?.id ?? null, source: 'manual', dataEnc: encryptJson(rx), status: 'pending' }).returning({ id: prescription.id })
      normalized.prescriptionId = rec!.id
      normalized.rxMode = 'manual'
    } else if (mode === 'upload') {
      const file = formData.get('rxFile')
      if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Alege o poză sau un PDF cu rețeta.' }
      try {
        const stored = await storePrivateFile(file, 'rx')
        const [rec] = await db.insert(prescription).values({ userId: user?.id ?? null, source: 'upload', fileKey: stored.key, fileMime: stored.mime, status: 'pending' }).returning({ id: prescription.id })
        normalized.prescriptionId = rec!.id
        normalized.rxMode = 'upload'
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Încărcarea a eșuat.' }
      }
    } else if (mode === 'saved' && config.prescriptionId && user) {
      const owned = await db.query.prescription.findFirst({ where: and(eq(prescription.id, config.prescriptionId), eq(prescription.userId, user.id)) })
      if (!owned) return { ok: false, error: 'Rețeta salvată nu a fost găsită.' }
      normalized.prescriptionId = owned.id
      normalized.rxMode = 'saved'
    } else {
      normalized.rxMode = 'later'
      normalized.prescriptionId = undefined
    }
  }

  const priced = priceConfiguration(frame, normalized, lenses, settings.vat)
  if (!priced.ok) return { ok: false, error: priced.errors[0]! }

  const cartId = await ensureCartId(user?.id)
  // Frames without lenses merge into one line; configured glasses are always separate lines.
  if (normalized.lensType === 'none') {
    const same = await db.query.cartItem.findFirst({ where: and(eq(cartItem.cartId, cartId), eq(cartItem.variantId, v.id)) })
    if (same && same.configuration.lensType === 'none') {
      await db.update(cartItem).set({ quantity: Math.min(same.quantity + 1, 10) }).where(eq(cartItem.id, same.id))
    } else {
      await db.insert(cartItem).values({ cartId, variantId: v.id, quantity: 1, configuration: normalized })
    }
  } else {
    await db.insert(cartItem).values({ cartId, variantId: v.id, quantity: 1, configuration: normalized })
  }
  const view = await loadCart()
  refresh()
  return { ok: true, data: { count: view.lines.reduce((s, l) => s + l.quantity, 0) } }
}

export async function updateQuantity(lineId: string, quantity: number): Promise<ActionResult> {
  const cartId = await getCartId()
  if (!cartId) return { ok: false, error: 'Coșul a expirat.' }
  const line = await db.query.cartItem.findFirst({ where: and(eq(cartItem.id, lineId), eq(cartItem.cartId, cartId)) })
  if (!line) return { ok: false, error: 'Produsul nu mai este în coș.' }
  if (quantity <= 0) await db.delete(cartItem).where(eq(cartItem.id, lineId))
  else {
    // A pair of prescription glasses is always quantity 1
    const q = line.configuration.lensType === 'none' ? Math.min(quantity, 10) : 1
    await db.update(cartItem).set({ quantity: q }).where(eq(cartItem.id, lineId))
  }
  refresh()
  return { ok: true }
}

export async function removeLine(lineId: string): Promise<ActionResult> {
  return updateQuantity(lineId, 0)
}

export async function applyCoupon(code: string): Promise<ActionResult> {
  if (!(await rateLimit('cart:coupon', 10, 300))) return { ok: false, error: 'Prea multe încercări. Revino peste câteva minute.' }
  const cartId = await getCartId()
  if (!cartId) return { ok: false, error: 'Coșul este gol.' }
  const clean = code.trim().toUpperCase().slice(0, 40)
  if (!clean) {
    await db.update(cart).set({ couponCode: null }).where(eq(cart.id, cartId))
    refresh()
    return { ok: true }
  }
  const c = await db.query.coupon.findFirst({ where: eq(coupon.code, clean) })
  if (!c) return { ok: false, error: 'Codul nu există.' }
  const view = await loadCart()
  const problem = couponProblem(c, view.totals.subtotal)
  if (problem) return { ok: false, error: problem }
  await db.update(cart).set({ couponCode: clean }).where(eq(cart.id, cartId))
  refresh()
  return { ok: true, message: c.description ?? 'Cod aplicat.' }
}
