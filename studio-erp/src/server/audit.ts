import 'server-only'
import { headers } from 'next/headers'
import { db, type Tx } from '@/lib/db'
import { auditLog } from '@/lib/db/schema'
import type { SessionUser } from './session'

export async function audit(actor: Pick<SessionUser, 'id' | 'email'> | null, action: string, entity: string, entityId?: string | null, data?: unknown, tx: Tx | typeof db = db) {
  let ip: string | null = null
  try {
    ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  } catch {
    /* outside a request */
  }
  await tx.insert(auditLog).values({ actorId: actor?.id ?? null, actorEmail: actor?.email ?? null, action, entity, entityId: entityId ?? null, data: data ?? null, ip })
}
