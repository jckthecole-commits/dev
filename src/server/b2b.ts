import 'server-only'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { partner } from '@/lib/db/schema'
import { getCurrentUser } from './session'

/** Approved partner for the signed-in user (or null). */
export async function getMyPartner() {
  const user = await getCurrentUser()
  if (!user) return null
  const p = await db.query.partner.findFirst({ where: eq(partner.userId, user.id) })
  return p && p.status === 'approved' ? { user, partner: p } : null
}

export async function requirePartner() {
  const user = await getCurrentUser()
  if (!user) redirect('/cont/autentificare?next=/b2b/portal')
  const me = await getMyPartner()
  if (!me) redirect('/b2b?portal=1')
  return me
}

/** Wholesale (net) prices — never part of the public catalogue payload. */
export async function getWholesalePrices(): Promise<Map<string, number>> {
  const { product } = await import('@/lib/db/schema')
  const rows = await db.select({ id: product.id, price: product.price, wholesale: product.wholesalePrice }).from(product)
  return new Map(rows.map((r) => [r.id, r.wholesale ?? Math.round(r.price / 2.4)]))
}
