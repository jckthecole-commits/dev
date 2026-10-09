import 'server-only'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { CLIENT_IP_HEADER } from '@/lib/client-ip'
import { auditLog } from '@/lib/db/schema'
import type { SessionUser } from './session'

export async function audit(actor: Pick<SessionUser, 'id' | 'email'> | null, action: string, entity: string, entityId?: string | null, data?: unknown) {
  let ip: string | null = null
  try {
    const h = await headers()
    ip = h.get(CLIENT_IP_HEADER)
  } catch {
    /* outside a request */
  }
  await db.insert(auditLog).values({ actorId: actor?.id ?? null, actorEmail: actor?.email ?? null, action, entity, entityId: entityId ?? null, data: data ?? null, ip })
}
