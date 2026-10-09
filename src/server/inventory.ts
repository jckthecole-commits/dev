import 'server-only'
import { and, asc, eq, gte, sql } from 'drizzle-orm'
import type { DB } from '@/lib/db'
import { inventory, location, orderItem, stockMovement } from '@/lib/db/schema'

type Tx = Parameters<Parameters<DB['transaction']>[0]>[0]

/**
 * Atomically reserve stock for one line. Tries locations in preference order
 * (showroom first for pickup orders, warehouse first otherwise).
 * Returns the location id, or null when no single location has enough stock.
 */
export async function reserveLine(tx: Tx, variantId: string, quantity: number, preferStore: boolean): Promise<string | null> {
  const locs = await tx
    .select({ id: location.id, kind: location.kind })
    .from(location)
    .where(eq(location.sellable, true))
    .orderBy(asc(location.code))
  const rank = (l: { kind: string }) => ((l.kind === 'store') === preferStore ? 0 : 1)
  locs.sort((a, b) => rank(a) - rank(b))
  for (const loc of locs) {
    const res = await tx
      .update(inventory)
      .set({ reserved: sql`${inventory.reserved} + ${quantity}` })
      .where(and(eq(inventory.variantId, variantId), eq(inventory.locationId, loc.id), gte(sql`${inventory.onHand} - ${inventory.reserved}`, quantity)))
      .returning({ variantId: inventory.variantId })
    if (res.length) return loc.id
  }
  return null
}

/** Release reservations (cancelled order). */
export async function releaseOrder(tx: Tx, orderId: string) {
  const items = await tx.select().from(orderItem).where(eq(orderItem.orderId, orderId))
  for (const it of items) {
    if (!it.variantId || !it.stockLocationId) continue
    await tx
      .update(inventory)
      .set({ reserved: sql`greatest(${inventory.reserved} - ${it.quantity}, 0)` })
      .where(and(eq(inventory.variantId, it.variantId), eq(inventory.locationId, it.stockLocationId)))
    await tx.update(orderItem).set({ stockLocationId: null }).where(eq(orderItem.id, it.id))
  }
}

/** Consume reservations when goods leave (shipped / picked up). Idempotent per line. */
export async function consumeOrder(tx: Tx, orderId: string, orderNumber: string, actorId?: string) {
  const items = await tx.select().from(orderItem).where(eq(orderItem.orderId, orderId))
  for (const it of items) {
    if (!it.variantId || !it.stockLocationId) continue
    await tx
      .update(inventory)
      .set({ onHand: sql`greatest(${inventory.onHand} - ${it.quantity}, 0)`, reserved: sql`greatest(${inventory.reserved} - ${it.quantity}, 0)` })
      .where(and(eq(inventory.variantId, it.variantId), eq(inventory.locationId, it.stockLocationId)))
    await tx.insert(stockMovement).values({ variantId: it.variantId, locationId: it.stockLocationId, delta: -it.quantity, reason: 'sale', reference: orderNumber, actorId })
    await tx.update(orderItem).set({ stockLocationId: null }).where(eq(orderItem.id, it.id))
  }
}
