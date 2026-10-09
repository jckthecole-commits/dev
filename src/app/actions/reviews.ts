'use server'

import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { order, orderItem, product, review } from '@/lib/db/schema'
import { rateLimit } from '@/server/rate-limit'
import { getCurrentUser } from '@/server/session'

const schema = z.object({
  productId: z.uuid(),
  name: z.string().trim().min(2, 'Spune-ne cum te numești.').max(60),
  city: z.string().trim().max(40).optional(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(80).optional(),
  body: z.string().trim().min(20, 'Scrie măcar o propoziție (20+ caractere).').max(2000),
  fit: z.enum(['narrow', 'true', 'wide']).optional(),
})

export async function submitReview(_: unknown, formData: FormData): Promise<{ ok: boolean; message: string }> {
  if (formData.get('website')) return { ok: true, message: 'Mulțumim!' }
  if (!(await rateLimit('review', 3, 3600))) return { ok: false, message: 'Ai trimis deja câteva recenzii. Revino mai târziu.' }
  const parsed = schema.safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => v !== '')))
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Verifică câmpurile.' }
  const d = parsed.data
  const p = await db.query.product.findFirst({ where: eq(product.id, d.productId), columns: { id: true } })
  if (!p) return { ok: false, message: 'Produsul nu există.' }
  const user = await getCurrentUser()
  let verified = false
  if (user) {
    const r = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(orderItem)
      .innerJoin(order, eq(order.id, orderItem.orderId))
      .where(and(eq(order.userId, user.id), eq(orderItem.productId, d.productId), eq(order.status, 'delivered')))
    verified = (r[0]?.n ?? 0) > 0
  }
  await db.insert(review).values({ ...d, userId: user?.id ?? null, verifiedPurchase: verified, status: 'pending' })
  return { ok: true, message: 'Mulțumim! Recenzia apare după o scurtă verificare.' }
}
