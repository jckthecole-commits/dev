'use server'

import { eq } from 'drizzle-orm'
import { refresh } from 'next/cache'
import { fail, ok, type ActionState } from '@/lib/action'
import { isMonth, monthLabel } from '@/lib/dates'
import { db } from '@/lib/db'
import { adjustment, model, payrollMonth, payslip } from '@/lib/db/schema'
import { parseAmount, parseRate } from '@/lib/money'
import { audit } from '@/server/audit'
import { getPayroll, isMonthClosed } from '@/server/payroll'
import { saveSetting } from '@/server/settings'
import { requirePermission } from '@/server/session'

const KINDS = ['bonus', 'advance', 'deduction'] as const

export async function addAdjustment(month: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const actor = await requirePermission('payroll:write')
  if (!isMonth(month)) return fail('Lună invalidă.')
  if (await isMonthClosed(month)) return fail('Luna e închisă.')
  const modelId = String(form.get('modelId') ?? '')
  const kind = String(form.get('kind') ?? '') as (typeof KINDS)[number]
  const amountCents = parseAmount(String(form.get('amount') ?? ''))
  const note = String(form.get('note') ?? '').trim() || null
  const errors: Record<string, string> = {}
  if (!modelId) errors.modelId = 'Alege modelul.'
  if (!KINDS.includes(kind)) errors.kind = 'Tip invalid.'
  if (!amountCents) errors.amount = 'Sumă invalidă.'
  if (Object.keys(errors).length) return fail('Verifică câmpurile marcate.', errors)
  if (!(await db.query.model.findFirst({ where: eq(model.id, modelId), columns: { id: true } }))) return fail('Model inexistent.')
  const [row] = await db.insert(adjustment).values({ modelId, month, kind, amountCents: amountCents!, note, createdBy: actor.id }).returning({ id: adjustment.id })
  await audit(actor, 'adjustment.add', 'adjustment', row!.id, { modelId, month, kind, amountCents })
  refresh()
  return ok('Adăugat.')
}

export async function deleteAdjustment(id: string): Promise<ActionState> {
  const actor = await requirePermission('payroll:write')
  const row = await db.query.adjustment.findFirst({ where: eq(adjustment.id, id) })
  if (!row) return fail('Nu mai există.')
  if (await isMonthClosed(row.month)) return fail('Luna e închisă.')
  await db.delete(adjustment).where(eq(adjustment.id, id))
  await audit(actor, 'adjustment.delete', 'adjustment', id, { modelId: row.modelId, month: row.month, kind: row.kind, amountCents: row.amountCents })
  refresh()
  return ok()
}

/** Freezes the month: payslips are written with the given exchange rate and earnings/adjustments become read-only. */
export async function closeMonth(month: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const actor = await requirePermission('payroll:close')
  if (!isMonth(month)) return fail('Lună invalidă.')
  const rate = parseRate(String(form.get('rate') ?? ''))
  if (!rate) return fail('Curs invalid (ex. 4,6512).', { rate: 'Curs invalid.' })

  const res = await db.transaction(async (tx) => {
    const inserted = await tx.insert(payrollMonth).values({ month, usdToRonE4: rate, closedBy: actor.id }).onConflictDoNothing().returning()
    if (!inserted.length) return null
    const payroll = await getPayroll(month, { usdToRonE4: rate, live: true }, tx)
    if (payroll.rows.length) {
      await tx.insert(payslip).values(
        payroll.rows.map((r) => ({
          month,
          modelId: r.modelId,
          planName: r.planName,
          grossCents: r.grossCents,
          percentBp: r.percentBp,
          shareCents: r.shareCents,
          bonusCents: r.bonusCents,
          advanceCents: r.advanceCents,
          deductionCents: r.deductionCents,
          netCents: r.netCents,
          netBani: r.netBani,
        })),
      )
    }
    await audit(actor, 'payroll.close', 'payroll', month, { usdToRonE4: rate, payslips: payroll.rows.length }, tx)
    return payroll.rows.length
  })
  if (res === null) return fail('Luna era deja închisă.')
  await saveSetting('usdToRonE4', rate)
  refresh()
  return ok(`${monthLabel(month)} închisă: ${res} fluturași generați.`)
}

/** Reopens a closed month (deletes its payslips) so a mistake can be corrected. */
export async function reopenMonth(month: string, _prev: ActionState, _f: FormData): Promise<ActionState> {
  const actor = await requirePermission('payroll:close')
  const [row] = await db.delete(payrollMonth).where(eq(payrollMonth.month, month)).returning()
  if (!row) return fail('Luna nu era închisă.')
  await audit(actor, 'payroll.reopen', 'payroll', month, { usdToRonE4: row.usdToRonE4 })
  refresh()
  return ok('Luna e redeschisă. Fluturașii au fost șterși și se vor regenera la închidere.')
}
