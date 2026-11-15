/**
 * Create (or reset) an administrator.
 *
 *   ADMIN_PASSWORD='…' pnpm admin:create --email you@example.com --name "Your Name"
 *
 * The password comes from ADMIN_PASSWORD or an interactive prompt, never from the command line.
 */
import './env'
import { hashPassword } from 'better-auth/crypto'
import { and, eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { parseArgs } from 'node:util'
import postgres from 'postgres'
import * as s from '../src/lib/db/schema'

const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' } } })
const email = values.email?.trim().toLowerCase()
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('Usage: pnpm admin:create --email you@example.com --name "Your Name"')

function fail(msg: string): never {
  console.error(msg)
  process.exit(1)
}

async function readPassword(): Promise<string> {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD
  if (!process.stdin.isTTY) fail('Set ADMIN_PASSWORD when running non-interactively.')
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const pw = await rl.question('Password (min. 12 characters): ')
  rl.close()
  return pw
}

const client = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} })
const db = drizzle(client, { schema: s, casing: 'snake_case' })
try {
  const password = await readPassword()
  if (password.length < 12) fail('Password must have at least 12 characters.')
  const hashed = await hashPassword(password)
  const existing = await db.query.user.findFirst({ where: eq(sql`lower(${s.user.email})`, email) })
  if (existing) {
    await db.update(s.user).set({ role: 'admin', active: true }).where(eq(s.user.id, existing.id))
    const cred = await db.query.account.findFirst({ where: and(eq(s.account.userId, existing.id), eq(s.account.providerId, 'credential')) })
    if (cred) await db.update(s.account).set({ password: hashed }).where(eq(s.account.id, cred.id))
    else await db.insert(s.account).values({ id: randomUUID(), accountId: existing.id, providerId: 'credential', userId: existing.id, password: hashed })
    await db.delete(s.session).where(eq(s.session.userId, existing.id))
    console.log(`✓ ${email} is an active admin (password updated, sessions revoked)`)
  } else {
    const id = randomUUID()
    await db.insert(s.user).values({ id, email, name: values.name?.trim() || email.split('@')[0]!, role: 'admin', emailVerified: true })
    await db.insert(s.account).values({ id: randomUUID(), accountId: id, providerId: 'credential', userId: id, password: hashed })
    console.log(`✓ created admin ${email}`)
  }
  await db.insert(s.auditLog).values({ action: 'user.create-cli', entity: 'user', entityId: email, data: { role: 'admin' } })
} finally {
  await client.end()
}
