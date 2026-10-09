import 'server-only'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { cart, cartItem, coupon, inventory, location, prescription, product, variant, type LineConfiguration } from '@/lib/db/schema'
import { computeTotals, priceConfiguration, type PricedLine, type ShippingChoice, type Totals } from '@/lib/pricing'
import { getLensCatalog } from './catalog'
import { getSettings } from './settings'

export const CART_COOKIE = 'sv_cart'
const CART_MAX_AGE = 60 * 60 * 24 * 30
// Secure only when the site is served over HTTPS: a browser drops Secure cookies set over
// plain HTTP (a LAN address, a local install), and every page would start a new, empty cart
const SECURE_COOKIE = (process.env.NEXT_PUBLIC_SITE_URL ?? '').startsWith('https://')

export async function getCartId(): Promise<string | null> {
  const id = (await cookies()).get(CART_COOKIE)?.value
  return id && /^[0-9a-f-]{36}$/.test(id) ? id : null
}

/** Only callable from Server Actions / Route Handlers (sets a cookie). */
export async function ensureCartId(userId?: string | null): Promise<string> {
  const existing = await getCartId()
  if (existing) {
    const row = await db.query.cart.findFirst({ where: eq(cart.id, existing), columns: { id: true } })
    if (row) return row.id
  }
  const [row] = await db.insert(cart).values({ userId: userId ?? null }).returning({ id: cart.id })
  ;(await cookies()).set(CART_COOKIE, row!.id, { httpOnly: true, sameSite: 'lax', secure: SECURE_COOKIE, path: '/', maxAge: CART_MAX_AGE })
  return row!.id
}

export async function getCartCount(): Promise<number> {
  const id = await getCartId()
  if (!id) return 0
  const r = await db.select({ n: sql<number>`coalesce(sum(${cartItem.quantity}), 0)::int` }).from(cartItem).where(eq(cartItem.cartId, id))
  return r[0]?.n ?? 0
}

export type CartLine = {
  id: string
  quantity: number
  configuration: LineConfiguration
  priced: PricedLine
  available: number
  rx: { status: string; source: string } | null
  product: {
    id: string
    slug: string
    name: string
    category: 'optical' | 'sun'
    shape: string
    material: string
    rim: 'full' | 'semi' | 'rimless'
    lensWidth: number
    bridgeWidth: number
    templeLength: number
    lensHeight: number
    geometry: typeof product.$inferSelect.geometry
    vatClass: 'standard' | 'reduced' | 'exempt'
  }
  variant: { id: string; sku: string; colorName: string; swatch: typeof variant.$inferSelect.swatch }
}

export type CartView = { id: string | null; lines: CartLine[]; couponCode: string | null; totals: Totals; problems: string[] }

export async function loadCart(opts: { shippingMethod?: ShippingChoice; paymentMethod?: 'card' | 'cod' | 'transfer' | 'store' } = {}): Promise<CartView> {
  const id = await getCartId()
  const [settings, lenses] = await Promise.all([getSettings(), getLensCatalog()])
  const empty = computeTotals({ lines: [], shipping: settings.shipping, vatStandard: settings.vat.standard })
  if (!id) return { id: null, lines: [], couponCode: null, totals: empty, problems: [] }

  const c = await db.query.cart.findFirst({ where: eq(cart.id, id) })
  if (!c) return { id: null, lines: [], couponCode: null, totals: empty, problems: [] }

  const items = await db
    .select({ item: cartItem, v: variant, p: product })
    .from(cartItem)
    .innerJoin(variant, eq(variant.id, cartItem.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .where(eq(cartItem.cartId, id))
    .orderBy(asc(cartItem.createdAt))

  const variantIds = items.map((i) => i.v.id)
  const stock = variantIds.length
    ? await db
        .select({ variantId: inventory.variantId, available: sql<number>`sum(greatest(${inventory.onHand} - ${inventory.reserved}, 0))::int` })
        .from(inventory)
        .innerJoin(location, eq(location.id, inventory.locationId))
        .where(and(inArray(inventory.variantId, variantIds), eq(location.sellable, true)))
        .groupBy(inventory.variantId)
    : []
  const rxIds = items.map((i) => i.item.configuration.prescriptionId).filter((x): x is string => !!x)
  const rxRows = rxIds.length ? await db.select({ id: prescription.id, status: prescription.status, source: prescription.source }).from(prescription).where(inArray(prescription.id, rxIds)) : []

  const problems: string[] = []
  const lines: CartLine[] = items.map(({ item, v, p }) => {
    const priced = priceConfiguration(
      { name: p.name, variantName: v.colorName, price: p.price + v.priceDelta, category: p.category, lensHeight: p.lensHeight, rim: p.rim, vatClass: p.vatClass },
      item.configuration,
      lenses,
      settings.vat,
    )
    const available = stock.find((s) => s.variantId === v.id)?.available ?? 0
    if (p.status !== 'active' || !v.active) problems.push(`${p.name} (${v.colorName}) nu mai este disponibilă.`)
    else if (available < item.quantity) problems.push(`${p.name} (${v.colorName}): ${available ? `mai sunt doar ${available} bucăți` : 'stoc epuizat momentan'}.`)
    for (const e of priced.errors) problems.push(`${p.name}: ${e}`)
    const rx = rxRows.find((r) => r.id === item.configuration.prescriptionId)
    return {
      id: item.id,
      quantity: item.quantity,
      configuration: item.configuration,
      priced,
      available,
      rx: rx ? { status: rx.status, source: rx.source } : null,
      product: { id: p.id, slug: p.slug, name: p.name, category: p.category, shape: p.shape, material: p.material, rim: p.rim, lensWidth: p.lensWidth, bridgeWidth: p.bridgeWidth, templeLength: p.templeLength, lensHeight: p.lensHeight, geometry: p.geometry, vatClass: p.vatClass },
      variant: { id: v.id, sku: v.sku, colorName: v.colorName, swatch: v.swatch },
    }
  })

  const cp = c.couponCode ? await db.query.coupon.findFirst({ where: eq(coupon.code, c.couponCode) }) : null
  const totals = computeTotals({
    lines: lines.map((l) => ({ unitPrice: l.priced.unitPrice, quantity: l.quantity, framePrice: l.priced.framePrice, lensPrice: l.priced.lensPrice, vat: l.priced.vat })),
    coupon: cp ?? null,
    shippingMethod: opts.shippingMethod,
    paymentMethod: opts.paymentMethod,
    shipping: settings.shipping,
    vatStandard: settings.vat.standard,
  })
  return { id, lines, couponCode: c.couponCode, totals, problems }
}
