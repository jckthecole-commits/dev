'use server'

import { eq } from 'drizzle-orm'
import { refresh } from 'next/cache'
import { z } from 'zod'
import { fail, ok, type ActionState } from '@/lib/action'
import { db } from '@/lib/db'
import { payoutPlan, platform, room, shift, type PayoutTier } from '@/lib/db/schema'
import { parseAmount, parsePercent, parseRate } from '@/lib/money'
import { validateTiers } from '@/lib/payroll'
import { audit } from '@/server/audit'
import { isUniqueViolation } from '@/server/db-errors'
import { saveSetting } from '@/server/settings'
import { requirePermission } from '@/server/session'

export async function saveStudio(_prev: ActionState, form: FormData): Promise<ActionState> {
  const actor = await requirePermission('settings:write')
  const name = String(form.get('studioName') ?? '').trim()
  const rate = parseRate(String(form.get('rate') ?? ''))
  if (!name || name.length > 60) return fail('Numele studioului e obligatoriu (max. 60 caractere).')
  if (!rate) return fail('Curs invalid (ex. 4,6512).')
  await saveSetting('studioName', name)
  await saveSetting('usdToRonE4', rate)
  await audit(actor, 'settings.studio', 'setting', null, { name, rate })
  refresh()
  return ok('Salvat.')
}

const Kind = z.enum(['room', 'platform'])
const tableFor = (k: z.infer<typeof Kind>) => (k === 'room' ? room : platform)

/** Rooms and platforms are just named, sortable, switchable lists. */
export async function addNamed(kind: 'room' | 'platform', _prev: ActionState, form: FormData): Promise<ActionState> {
  const actor = await requirePermission('settings:write')
  const k = Kind.parse(kind)
  const name = String(form.get('name') ?? '').trim()
  if (!name || name.length > 40) return fail('Scrie un nume (max. 40 caractere).')
  try {
    const t = tableFor(k)
    const [row] = await db.insert(t).values({ name, sort: Date.now() % 1_000_000 }).returning({ id: t.id })
    await audit(actor, `${k}.add`, k, row!.id, { name })
  } catch (e) {
    if (isUniqueViolation(e)) return fail('Există deja.')
    throw e
  }
  refresh()
  return ok('Adăugat.')
}

export async function toggleNamed(kind: 'room' | 'platform' | 'shift', id: string, active: boolean): Promise<ActionState> {
  const actor = await requirePermission('settings:write')
  const t = kind === 'shift' ? shift : tableFor(Kind.parse(kind))
  await db.update(t).set({ active }).where(eq(t.id, id))
  await audit(actor, `${kind}.${active ? 'enable' : 'disable'}`, kind, id)
  refresh()
  return ok()
}

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/

export async function addShift(_prev: ActionState, form: FormData): Promise<ActionState> {
  const actor = await requirePermission('settings:write')
  const name = String(form.get('name') ?? '').trim()
  const start = String(form.get('start') ?? '')
  const end = String(form.get('end') ?? '')
  if (!name || name.length > 40) return fail('Scrie un nume pentru tură.')
  if (!timeRe.test(start) || !timeRe.test(end)) return fail('Ore invalide.')
  if (start === end) return fail('Tura trebuie să aibă durată.')
  try {
    const [row] = await db.insert(shift).values({ name, startTime: start, endTime: end, sort: Number(start.replace(':', '')) }).returning({ id: shift.id })
    await audit(actor, 'shift.add', 'shift', row!.id, { name, start, end })
  } catch (e) {
    if (isUniqueViolation(e)) return fail('Există deja o tură cu acest nume.')
    throw e
  }
  refresh()
  return ok('Tură adăugată.')
}

/** Creates or updates a payout plan from parallel `from[]` (USD) and `pct[]` inputs. */
export async function savePlan(id: string | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  const actor = await requirePermission('settings:write')
  const name = String(form.get('name') ?? '').trim()
  const mode = form.get('mode') === 'progressive' ? 'progressive' : 'whole'
  const isDefault = form.get('isDefault') === 'on'
  if (!name || name.length > 60) return fail('Planul are nevoie de un nume.')
  const froms = form.getAll('from').map(String)
  const pcts = form.getAll('pct').map(String)
  const tiers: PayoutTier[] = []
  for (let i = 0; i < froms.length; i++) {
    if (!froms[i]!.trim() && !pcts[i]?.trim()) continue
    const fromCents = i === 0 && !froms[i]!.trim() ? 0 : parseAmount(froms[i]!)
    const percentBp = parsePercent(pcts[i] ?? '')
    if (fromCents === null || percentBp === null) return fail(`Pragul ${i + 1} are valori invalide.`)
    tiers.push({ fromCents, percentBp })
  }
  tiers.sort((a, b) => a.fromCents - b.fromCents)
  const err = validateTiers(tiers)
  if (err) return fail(err)

  try {
    await db.transaction(async (tx) => {
      if (isDefault) await tx.update(payoutPlan).set({ isDefault: false })
      if (id) await tx.update(payoutPlan).set({ name, mode, tiers, ...(isDefault ? { isDefault } : {}) }).where(eq(payoutPlan.id, id))
      else {
        const any = await tx.query.payoutPlan.findFirst({ columns: { id: true } })
        await tx.insert(payoutPlan).values({ name, mode, tiers, isDefault: isDefault || !any })
      }
    })
  } catch (e) {
    if (isUniqueViolation(e)) return fail('Există deja un plan cu acest nume.')
    throw e
  }
  await audit(actor, id ? 'plan.update' : 'plan.add', 'payout_plan', id, { name, mode, tiers, isDefault })
  refresh()
  return ok(id ? 'Plan salvat. Se aplică lunilor încă deschise.' : 'Plan creat.')
}
