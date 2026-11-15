import 'server-only'
import { hashPassword } from 'better-auth/crypto'
import { and, eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import type { Tx } from '@/lib/db'
import { account, session, user } from '@/lib/db/schema'
import type { Role } from '@/lib/roles'

export const findUserByEmail = (tx: Tx, email: string) => tx.query.user.findFirst({ where: eq(sql`lower(${user.email})`, email.toLowerCase()) })

/** Creates a login with a password chosen by the admin; the person changes it after signing in. */
export async function createLogin(tx: Tx, input: { name: string; email: string; role: Role; password: string; phone?: string | null }): Promise<string> {
  const id = randomUUID()
  await tx.insert(user).values({ id, name: input.name, email: input.email.toLowerCase(), role: input.role, phone: input.phone ?? null, emailVerified: true })
  await tx.insert(account).values({ id: randomUUID(), accountId: id, providerId: 'credential', userId: id, password: await hashPassword(input.password) })
  return id
}

export async function setPassword(tx: Tx, userId: string, password: string) {
  const hashed = await hashPassword(password)
  const cred = await tx.query.account.findFirst({ where: and(eq(account.userId, userId), eq(account.providerId, 'credential')) })
  if (cred) await tx.update(account).set({ password: hashed }).where(eq(account.id, cred.id))
  else await tx.insert(account).values({ id: randomUUID(), accountId: userId, providerId: 'credential', userId, password: hashed })
  await tx.delete(session).where(eq(session.userId, userId))
}

export const revokeSessions = (tx: Tx, userId: string) => tx.delete(session).where(eq(session.userId, userId))
