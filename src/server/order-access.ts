import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { order } from '@/lib/db/schema'
import { safeEqual } from '@/lib/crypto'
import { getCurrentUser, isStaff } from './session'

/** An order is visible to: the holder of its access token, its owner, or staff. */
export async function getAccessibleOrder(number: string, token: string | undefined) {
  const o = await db.query.order.findFirst({
    where: eq(order.number, number),
    with: { items: { with: { prescription: { columns: { id: true, status: true, source: true, reviewNote: true } } } }, events: true },
  })
  if (!o) return null
  if (token && safeEqual(token, o.accessToken)) return o
  const user = await getCurrentUser()
  if (user && (o.userId === user.id || isStaff(user.role))) return o
  return null
}
