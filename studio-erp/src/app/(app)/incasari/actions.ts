'use server'

import { eq, inArray, sql } from 'drizzle-orm'
import { refresh } from 'next/cache'
import { fail, ok, type ActionState } from '@/lib/action'
import { parseEarningsCsv } from '@/lib/csv'
import { isDay, monthLabel } from '@/lib/dates'
import { db } from '@/lib/db'
import { earning, model, modelAlias, payrollMonth, platform } from '@/lib/db/schema'
import { parseAmount } from '@/lib/money'
import { audit } from '@/server/audit'
import { requirePermission } from '@/server/session'

async function closedMonths(months: string[]) {
  if (!months.length) return []
  const rows = await db.select({ month: payrollMonth.month }).from(payrollMonth).where(inArray(payrollMonth.month, months))
  return rows.map((r) => r.month)
}

export async function saveEarning(_prev: ActionState, form: FormData): Promise<ActionState> {
  const actor = await requirePermission('earnings:write')
  const modelId = String(form.get('modelId') ?? '')
  const platformId = String(form.get('platformId') ?? '')
  const day = String(form.get('day') ?? '')
  const amountCents = parseAmount(String(form.get('amount') ?? ''))
  const minutesRaw = String(form.get('minutes') ?? '').trim()
  const errors: Record<string, string> = {}
  if (!modelId) errors.modelId = 'Alege modelul.'
  if (!platformId) errors.platformId = 'Alege platforma.'
  if (!isDay(day)) errors.day = 'Dată invalidă.'
  if (amountCents === null) errors.amount = 'Sumă invalidă (ex. 125,50).'
  if (minutesRaw && !/^\d{1,4}$/.test(minutesRaw)) errors.minutes = 'Număr de minute invalid.'
  if (Object.keys(errors).length) return fail('Verifică câmpurile marcate.', errors)
  if ((await closedMonths([day.slice(0, 7)])).length) return fail(`Luna ${monthLabel(day.slice(0, 7))} e închisă; încasările nu se mai pot modifica.`)

  const [m, p] = await Promise.all([
    db.query.model.findFirst({ where: eq(model.id, modelId), columns: { id: true } }),
    db.query.platform.findFirst({ where: eq(platform.id, platformId), columns: { id: true } }),
  ])
  if (!m || !p) return fail('Model sau platformă inexistentă.')
  const minutes = minutesRaw ? Number(minutesRaw) : null
  const [row] = await db
    .insert(earning)
    .values({ modelId, platformId, day, amountCents: amountCents!, minutes, source: 'manual', createdBy: actor.id })
    .onConflictDoUpdate({ target: [earning.modelId, earning.platformId, earning.day], set: { amountCents: amountCents!, minutes, source: 'manual', createdBy: actor.id, updatedAt: new Date() } })
    .returning({ id: earning.id, inserted: sql<boolean>`(xmax = 0)` })
  await audit(actor, 'earning.save', 'earning', row!.id, { modelId, platformId, day, amountCents })
  refresh()
  return ok(row!.inserted ? 'Încasare adăugată.' : 'Încasarea existentă pentru acea zi a fost înlocuită.')
}

export async function deleteEarning(id: string): Promise<ActionState> {
  const actor = await requirePermission('earnings:write')
  const row = await db.query.earning.findFirst({ where: eq(earning.id, id) })
  if (!row) return fail('Nu mai există.')
  if ((await closedMonths([row.day.slice(0, 7)])).length) return fail('Luna e închisă.')
  await db.delete(earning).where(eq(earning.id, id))
  await audit(actor, 'earning.delete', 'earning', id, { modelId: row.modelId, day: row.day, amountCents: row.amountCents })
  refresh()
  return ok('Șters.')
}

const MAX_IMPORT_BYTES = 2 * 1024 * 1024

/**
 * Imports a CSV/TSV report (model, platforma, data, suma[, minute]). All or nothing: if any row is bad,
 * nothing is saved and every problem is listed with its line number. Rows already in the database
 * (same model, platform and day) are replaced, so re-importing a corrected report is safe.
 */
export async function importEarnings(_prev: ActionState, form: FormData): Promise<ActionState> {
  const actor = await requirePermission('earnings:write')
  const file = form.get('file')
  let text = String(form.get('text') ?? '')
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_IMPORT_BYTES) return fail('Fișierul e prea mare (maxim 2 MB).')
    text = await file.text()
  }
  if (!text.trim()) return fail('Alege un fișier sau lipește conținutul.')

  const { rows, errors } = parseEarningsCsv(text)
  const [platforms, models, aliases] = await Promise.all([
    db.select({ id: platform.id, name: platform.name }).from(platform),
    db.select({ id: model.id, stageName: model.stageName }).from(model),
    db.select({ modelId: modelAlias.modelId, platformId: modelAlias.platformId, username: modelAlias.username }).from(modelAlias),
  ])
  const lc = (s: string) => s.trim().toLowerCase()
  const seen = new Map<string, number>()
  const resolved: { modelId: string; platformId: string; day: string; amountCents: number; minutes: number | null }[] = []

  for (const r of rows) {
    const p = platforms.find((x) => lc(x.name) === lc(r.platform))
    if (!p) {
      errors.push({ line: r.line, message: `Platformă necunoscută: „${r.platform}”.` })
      continue
    }
    const modelId = aliases.find((a) => a.platformId === p.id && lc(a.username) === lc(r.model))?.modelId ?? models.find((m) => lc(m.stageName) === lc(r.model))?.id
    if (!modelId) {
      errors.push({ line: r.line, message: `Model necunoscut: „${r.model}” (nici nume de scenă, nici utilizator ${p.name}).` })
      continue
    }
    const key = `${modelId}|${p.id}|${r.day}`
    if (seen.has(key)) {
      errors.push({ line: r.line, message: `Rând dublat (același model, platformă și zi ca rândul ${seen.get(key)}).` })
      continue
    }
    seen.set(key, r.line)
    resolved.push({ modelId, platformId: p.id, day: r.day, amountCents: r.amountCents, minutes: r.minutes })
  }
  const closed = await closedMonths([...new Set(resolved.map((r) => r.day.slice(0, 7)))])
  if (closed.length) errors.push({ line: 0, message: `Fișierul are zile din luni închise: ${closed.map(monthLabel).join(', ')}.` })

  if (errors.length) {
    errors.sort((a, b) => a.line - b.line)
    const shown = errors.slice(0, 15).map((e) => (e.line ? `Rândul ${e.line}: ${e.message}` : e.message))
    if (errors.length > 15) shown.push(`…și încă ${errors.length - 15} probleme.`)
    return fail(`Nu am importat nimic. ${errors.length === 1 ? 'O problemă' : `${errors.length} probleme`}:\n${shown.join('\n')}`)
  }
  if (!resolved.length) return fail('Fișierul nu are rânduri de date.')

  const result = await db.transaction(async (tx) => {
    let inserted = 0
    for (let i = 0; i < resolved.length; i += 500) {
      const chunk = resolved.slice(i, i + 500).map((r) => ({ ...r, source: 'csv', createdBy: actor.id }))
      const out = await tx
        .insert(earning)
        .values(chunk)
        .onConflictDoUpdate({
          target: [earning.modelId, earning.platformId, earning.day],
          set: { amountCents: sql`excluded.amount_cents`, minutes: sql`excluded.minutes`, source: 'csv', createdBy: actor.id, updatedAt: new Date() },
        })
        .returning({ inserted: sql<boolean>`(xmax = 0)` })
      inserted += out.filter((o) => o.inserted).length
    }
    return { inserted, replaced: resolved.length - inserted }
  })
  await audit(actor, 'earning.import', 'earning', null, { rows: resolved.length, ...result })
  refresh()
  return ok(`Importat ${resolved.length} rânduri: ${result.inserted} noi, ${result.replaced} înlocuite.`)
}

