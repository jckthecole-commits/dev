'use server'

import { and, eq, ne, sql } from 'drizzle-orm'
import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { fail, fieldErrors, ok, type ActionState } from '@/lib/action'
import { isDay } from '@/lib/dates'
import { db } from '@/lib/db'
import { model, modelAlias, user } from '@/lib/db/schema'
import { createLogin, findUserByEmail, revokeSessions, setPassword } from '@/server/accounts'
import { audit } from '@/server/audit'
import { requirePermission } from '@/server/session'

const optional = z
  .string()
  .trim()
  .transform((s) => (s === '' ? null : s))
  .nullable()
  .default(null)

const ModelInput = z.object({
  stageName: z.string().trim().min(1, 'Numele de scenă e obligatoriu.').max(60),
  legalName: z.string().trim().min(2, 'Numele din acte e obligatoriu.').max(120),
  email: optional.pipe(z.email('E-mail invalid.').nullable()),
  phone: optional,
  status: z.enum(['onboarding', 'active', 'paused', 'left']),
  startDate: optional.refine((v) => v === null || isDay(v), 'Dată invalidă.'),
  trainerId: optional,
  payoutPlanId: optional,
  iban: optional.transform((v) => v?.replace(/\s/g, '').toUpperCase() ?? null).refine((v) => v === null || /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(v), 'IBAN invalid.'),
  notes: optional,
})

const read = (f: FormData) => Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === 'string'))

export async function saveModel(id: string | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  const actor = await requirePermission('models:write')
  const parsed = ModelInput.safeParse(read(form))
  if (!parsed.success) return fail('Verifică câmpurile marcate.', fieldErrors(parsed.error.issues))
  const data = parsed.data

  const clash = await db.query.model.findFirst({
    where: and(eq(sql`lower(${model.stageName})`, data.stageName.toLowerCase()), id ? ne(model.id, id) : undefined),
    columns: { id: true },
  })
  if (clash) return fail('Există deja un model cu acest nume de scenă.', { stageName: 'Nume deja folosit.' })
  if (data.trainerId) {
    const t = await db.query.user.findFirst({ where: eq(user.id, data.trainerId), columns: { role: true } })
    if (!t || t.role === 'model') return fail('Trainer invalid.', { trainerId: 'Alege un membru al echipei.' })
  }

  if (id) {
    const [row] = await db.update(model).set(data).where(eq(model.id, id)).returning({ id: model.id })
    if (!row) return fail('Modelul nu mai există.')
    await audit(actor, 'model.update', 'model', id, { stageName: data.stageName, status: data.status })
    refresh()
    return ok('Salvat.')
  }
  const [row] = await db.insert(model).values(data).returning({ id: model.id })
  await audit(actor, 'model.create', 'model', row!.id, { stageName: data.stageName })
  redirect(`/modele/${row!.id}`)
}

const LoginInput = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('E-mail invalid.')),
  password: z.string().min(10, 'Parola trebuie să aibă minim 10 caractere.').max(128),
})

/** Gives the model a login to the portal (own schedule, earnings, payslips), or resets its password. */
export async function setModelLogin(modelId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const actor = await requirePermission('models:write')
  const m = await db.query.model.findFirst({ where: eq(model.id, modelId) })
  if (!m) return fail('Modelul nu mai există.')

  if (m.userId) {
    const pw = LoginInput.shape.password.safeParse(form.get('password'))
    if (!pw.success) return fail(pw.error.issues[0]!.message, { password: pw.error.issues[0]!.message })
    await db.transaction((tx) => setPassword(tx, m.userId!, pw.data))
    await audit(actor, 'model.login.password', 'model', modelId)
    return ok('Parolă schimbată. Sesiunile vechi au fost închise.')
  }

  const parsed = LoginInput.safeParse(read(form))
  if (!parsed.success) return fail('Verifică câmpurile.', fieldErrors(parsed.error.issues))
  const res = await db.transaction(async (tx) => {
    if (await findUserByEmail(tx, parsed.data.email)) return 'taken' as const
    const userId = await createLogin(tx, { name: m.stageName, email: parsed.data.email, role: 'model', password: parsed.data.password, phone: m.phone })
    await tx.update(model).set({ userId }).where(eq(model.id, modelId))
    return 'ok' as const
  })
  if (res === 'taken') return fail('Adresa e deja folosită de alt cont.', { email: 'Adresă folosită.' })
  await audit(actor, 'model.login.create', 'model', modelId, { email: parsed.data.email })
  refresh()
  return ok('Cont creat. Trimite-i modelului adresa și parola.')
}

export async function setModelLoginActive(modelId: string, active: boolean): Promise<ActionState> {
  const actor = await requirePermission('models:write')
  const m = await db.query.model.findFirst({ where: eq(model.id, modelId), columns: { userId: true } })
  if (!m?.userId) return fail('Modelul nu are cont.')
  await db.transaction(async (tx) => {
    await tx.update(user).set({ active }).where(eq(user.id, m.userId!))
    if (!active) await revokeSessions(tx, m.userId!)
  })
  await audit(actor, active ? 'model.login.enable' : 'model.login.disable', 'model', modelId)
  refresh()
  return ok(active ? 'Cont reactivat.' : 'Cont dezactivat.')
}

export async function addAlias(modelId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const actor = await requirePermission('models:write')
  const platformId = String(form.get('platformId') ?? '')
  const username = String(form.get('username') ?? '').trim()
  if (!platformId || !username) return fail('Alege platforma și scrie numele de utilizator.')
  const taken = await db.query.modelAlias.findFirst({ where: and(eq(modelAlias.platformId, platformId), eq(sql`lower(${modelAlias.username})`, username.toLowerCase())) })
  if (taken) return fail(taken.modelId === modelId ? 'Există deja.' : 'Acest utilizator e legat de alt model.')
  await db.insert(modelAlias).values({ modelId, platformId, username })
  await audit(actor, 'model.alias.add', 'model', modelId, { platformId, username })
  refresh()
  return ok('Adăugat.')
}

export async function removeAlias(aliasId: string): Promise<ActionState> {
  const actor = await requirePermission('models:write')
  const [row] = await db.delete(modelAlias).where(eq(modelAlias.id, aliasId)).returning()
  if (row) await audit(actor, 'model.alias.remove', 'model', row.modelId, { username: row.username })
  refresh()
  return ok()
}
