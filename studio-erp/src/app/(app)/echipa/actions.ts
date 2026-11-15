'use server'

import { and, eq, ne, sql } from 'drizzle-orm'
import { refresh } from 'next/cache'
import { z } from 'zod'
import { fail, fieldErrors, ok, type ActionState } from '@/lib/action'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { createLogin, findUserByEmail, revokeSessions, setPassword } from '@/server/accounts'
import { audit } from '@/server/audit'
import { requirePermission } from '@/server/session'

const STAFF = ['admin', 'manager', 'trainer'] as const

const MemberInput = z.object({
  name: z.string().trim().min(2, 'Numele e obligatoriu.').max(80),
  email: z.string().trim().toLowerCase().pipe(z.email('E-mail invalid.')),
  role: z.enum(STAFF, 'Rol invalid.'),
  phone: z.string().trim().max(30).optional(),
  password: z.string().min(10, 'Minim 10 caractere.').max(128),
})

export async function addMember(_prev: ActionState, form: FormData): Promise<ActionState> {
  const actor = await requirePermission('team:write')
  const parsed = MemberInput.safeParse(Object.fromEntries(form))
  if (!parsed.success) return fail('Verifică câmpurile marcate.', fieldErrors(parsed.error.issues))
  const d = parsed.data
  const id = await db.transaction(async (tx) => {
    if (await findUserByEmail(tx, d.email)) return null
    return createLogin(tx, { name: d.name, email: d.email, role: d.role, password: d.password, phone: d.phone || null })
  })
  if (!id) return fail('Adresa e deja folosită.', { email: 'Adresă folosită.' })
  await audit(actor, 'team.add', 'user', id, { email: d.email, role: d.role })
  refresh()
  return ok(`${d.name} a fost adăugat. Trimite-i adresa și parola.`)
}

/** True if the change would leave the studio without an active administrator. */
async function wouldOrphanAdmins(userId: string) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(user)
    .where(and(eq(user.role, 'admin'), eq(user.active, true), ne(user.id, userId)))
  return (r?.n ?? 0) === 0
}

export async function updateMember(userId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const actor = await requirePermission('team:write')
  const role = z.enum(STAFF).safeParse(form.get('role'))
  if (!role.success) return fail('Rol invalid.')
  const target = await db.query.user.findFirst({ where: eq(user.id, userId) })
  if (!target || target.role === 'model') return fail('Membru inexistent.')
  if (target.role === 'admin' && role.data !== 'admin' && (await wouldOrphanAdmins(userId))) return fail('Trebuie să rămână cel puțin un administrator activ.')
  await db.update(user).set({ role: role.data }).where(eq(user.id, userId))
  await audit(actor, 'team.role', 'user', userId, { from: target.role, to: role.data })
  refresh()
  return ok('Rol salvat.')
}

export async function setMemberActive(userId: string, active: boolean): Promise<ActionState> {
  const actor = await requirePermission('team:write')
  if (userId === actor.id) return fail('Nu te poți dezactiva singur.')
  const target = await db.query.user.findFirst({ where: eq(user.id, userId) })
  if (!target || target.role === 'model') return fail('Membru inexistent.')
  if (!active && target.role === 'admin' && (await wouldOrphanAdmins(userId))) return fail('Trebuie să rămână cel puțin un administrator activ.')
  await db.transaction(async (tx) => {
    await tx.update(user).set({ active }).where(eq(user.id, userId))
    if (!active) await revokeSessions(tx, userId)
  })
  await audit(actor, active ? 'team.enable' : 'team.disable', 'user', userId)
  refresh()
  return ok()
}

export async function resetMemberPassword(userId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const actor = await requirePermission('team:write')
  const pw = z.string().min(10, 'Minim 10 caractere.').max(128).safeParse(form.get('password'))
  if (!pw.success) return fail(pw.error.issues[0]!.message)
  const target = await db.query.user.findFirst({ where: eq(user.id, userId), columns: { role: true } })
  if (!target || target.role === 'model') return fail('Membru inexistent.')
  await db.transaction((tx) => setPassword(tx, userId, pw.data))
  await audit(actor, 'team.password', 'user', userId)
  return ok('Parolă schimbată; sesiunile vechi au fost închise.')
}
