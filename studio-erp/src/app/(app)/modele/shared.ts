import 'server-only'
import { asc, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { payoutPlan, user } from '@/lib/db/schema'

export async function formOptions() {
  const [trainers, plans] = await Promise.all([
    db.select({ id: user.id, name: user.name }).from(user).where(ne(user.role, 'model')).orderBy(asc(user.name)),
    db.select({ id: payoutPlan.id, name: payoutPlan.name }).from(payoutPlan).orderBy(asc(payoutPlan.name)),
  ])
  return { trainers, plans }
}
