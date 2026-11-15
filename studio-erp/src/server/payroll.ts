import 'server-only'
import { and, between, eq, inArray, sql } from 'drizzle-orm'
import { monthRange } from '@/lib/dates'
import { db, type Tx } from '@/lib/db'
import { adjustment, earning, model, payoutPlan, payrollMonth, payslip } from '@/lib/db/schema'
import { computePayLine, type PayLine } from '@/lib/payroll'
import { getSetting } from './settings'

export type PayrollRow = PayLine & { modelId: string; stageName: string; legalName: string; planName: string }
export type Payroll = { month: string; closed: boolean; usdToRonE4: number; closedAt: Date | null; rows: PayrollRow[] }

export const isMonthClosed = async (month: string, tx: Tx | typeof db = db) =>
  !!(await tx.query.payrollMonth.findFirst({ where: eq(payrollMonth.month, month), columns: { month: true } }))

/**
 * The month's pay for every model that earned something or has an adjustment.
 * Closed months come from the frozen payslips; open months (or `live`) are computed from today's plans.
 */
export async function getPayroll(month: string, opts: { modelId?: string; usdToRonE4?: number; live?: boolean } = {}, tx: Tx | typeof db = db): Promise<Payroll> {
  const closed = opts.live ? undefined : await tx.query.payrollMonth.findFirst({ where: eq(payrollMonth.month, month) })
  if (closed) {
    const slips = await tx
      .select({ s: payslip, stageName: model.stageName, legalName: model.legalName })
      .from(payslip)
      .innerJoin(model, eq(model.id, payslip.modelId))
      .where(and(eq(payslip.month, month), opts.modelId ? eq(payslip.modelId, opts.modelId) : undefined))
      .orderBy(sql`lower(${model.stageName})`)
    return {
      month,
      closed: true,
      usdToRonE4: closed.usdToRonE4,
      closedAt: closed.closedAt,
      rows: slips.map(({ s, stageName, legalName }) => ({ ...s, stageName, legalName })),
    }
  }

  const { first, last } = monthRange(month)
  const usdToRonE4 = opts.usdToRonE4 ?? (await getSetting('usdToRonE4'))
  const gross = await tx
    .select({ modelId: earning.modelId, cents: sql<number>`sum(${earning.amountCents})::int` })
    .from(earning)
    .where(and(between(earning.day, first, last), opts.modelId ? eq(earning.modelId, opts.modelId) : undefined))
    .groupBy(earning.modelId)
  const adj = await tx
    .select({
      modelId: adjustment.modelId,
      bonus: sql<number>`coalesce(sum(${adjustment.amountCents}) filter (where ${adjustment.kind} = 'bonus'), 0)::int`,
      advance: sql<number>`coalesce(sum(${adjustment.amountCents}) filter (where ${adjustment.kind} = 'advance'), 0)::int`,
      deduction: sql<number>`coalesce(sum(${adjustment.amountCents}) filter (where ${adjustment.kind} = 'deduction'), 0)::int`,
    })
    .from(adjustment)
    .where(and(eq(adjustment.month, month), opts.modelId ? eq(adjustment.modelId, opts.modelId) : undefined))
    .groupBy(adjustment.modelId)

  const ids = [...new Set([...gross.map((g) => g.modelId), ...adj.map((a) => a.modelId)])]
  if (!ids.length) return { month, closed: false, usdToRonE4, closedAt: null, rows: [] }

  const models = await tx.select().from(model).where(inArray(model.id, ids))
  const plans = await tx.select().from(payoutPlan)
  const fallback = plans.find((p) => p.isDefault) ?? plans[0]
  const rows = models.map((m) => {
    const plan = plans.find((p) => p.id === m.payoutPlanId) ?? fallback
    const g = gross.find((x) => x.modelId === m.id)?.cents ?? 0
    const a = adj.find((x) => x.modelId === m.id)
    const line = computePayLine(g, plan ?? { mode: 'whole', tiers: [] }, { bonusCents: a?.bonus ?? 0, advanceCents: a?.advance ?? 0, deductionCents: a?.deduction ?? 0 }, usdToRonE4)
    return { ...line, modelId: m.id, stageName: m.stageName, legalName: m.legalName, planName: plan?.name ?? '— fără plan —' }
  })
  rows.sort((a, b) => a.stageName.localeCompare(b.stageName, 'ro'))
  return { month, closed: false, usdToRonE4, closedAt: null, rows }
}
