import 'server-only'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { auditLog } from '@/lib/db/schema'
import type { SessionUser } from './session'

export async function audit(actor: Pick<SessionUser, 'id' | 'email'> | null, action: string, entity: string, entityId?: string | null, data?: unknown) {
  let ip: string | null = null
  try {
    const h = await headers()
    ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip')
  } catch {
    /* outside a request */
  }
  await db.insert(auditLog).values({ actorId: actor?.id ?? null, actorEmail: actor?.email ?? null, action, entity, entityId: entityId ?? null, data: data ?? null, ip })
}
