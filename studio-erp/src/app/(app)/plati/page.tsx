import { asc, eq, sql } from 'drizzle-orm'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge, Card, Empty, LinkButton, PageHeader, PeriodNav, Stat, Table } from '@/components/ui'
import { addMonths, currentMonth, isMonth, monthLabel } from '@/lib/dates'
import { db } from '@/lib/db'
import { adjustment, model } from '@/lib/db/schema'
import { formatPercent, formatRate, formatRon, formatUsd } from '@/lib/money'
import { can } from '@/lib/roles'
import { getPayroll } from '@/server/payroll'
import { requirePermission } from '@/server/session'
import { addAdjustment, closeMonth, deleteAdjustment, reopenMonth } from './actions'
import { AdjustmentForm, CloseMonthForm, DeleteButton, ReopenForm } from './forms'

export const metadata: Metadata = { title: 'Plăți' }

const KIND_LABEL = { bonus: 'Bonus', advance: 'Avans', deduction: 'Reținere' } as const

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const me = await requirePermission('payroll:read')
  const sp = await searchParams
  // default to last month: that's the one being paid
  const month = isMonth(sp.m) ? sp.m : addMonths(currentMonth(), -1)
  const payroll = await getPayroll(month)
  const canWrite = can(me.role, 'payroll:write') && !payroll.closed
  const [adjustments, models] = await Promise.all([
    db
      .select({ id: adjustment.id, kind: adjustment.kind, cents: adjustment.amountCents, note: adjustment.note, model: model.stageName })
      .from(adjustment)
      .innerJoin(model, eq(model.id, adjustment.modelId))
      .where(eq(adjustment.month, month))
      .orderBy(sql`lower(${model.stageName})`, asc(adjustment.createdAt)),
    canWrite ? db.select({ id: model.id, name: model.stageName }).from(model).orderBy(sql`lower(${model.stageName})`) : [],
  ])

  const sum = (k: 'grossCents' | 'shareCents' | 'netCents' | 'netBani') => payroll.rows.reduce((a, r) => a + r[k], 0)
  const label = monthLabel(month)

  return (
    <>
      <PageHeader
        title="Plăți"
        subtitle={
          payroll.closed ? (
            <span className="flex flex-wrap items-center gap-2"><Badge tone="good">Închisă</Badge> curs {formatRate(payroll.usdToRonE4)} RON/USD</span>
          ) : (
            <span className="flex flex-wrap items-center gap-2"><Badge tone="accent">Deschisă</Badge> calcul provizoriu la cursul {formatRate(payroll.usdToRonE4)}</span>
          )
        }
        actions={
          <>
            <PeriodNav prev={`/plati?m=${addMonths(month, -1)}`} next={`/plati?m=${addMonths(month, 1)}`} label={label} />
            {payroll.rows.length ? <LinkButton href={`/plati/${month}/export`} small prefetch={false}>Export CSV</LinkButton> : null}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Brut studio" value={formatUsd(sum('grossCents'))} />
        <Stat label="Partea modelelor" value={formatUsd(sum('shareCents'))} />
        <Stat label="De plată" value={formatUsd(sum('netCents'))} hint={formatRon(sum('netBani'))} />
        <Stat label="Rămâne la studio" value={formatUsd(sum('grossCents') - sum('shareCents'))} hint="înainte de bonusuri" />
      </div>

      <div className="space-y-6">
        <Card title={`Calcul pe modele · ${label}`} className="min-w-0">
          {payroll.rows.length === 0 ? (
            <Empty>Nicio încasare sau ajustare în {label}.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Model</th><th className="text-right">Brut</th><th className="text-right">%</th><th className="text-right">Cota</th>
                  <th className="text-right">Bonus</th><th className="text-right">Avans</th><th className="text-right">Rețineri</th><th className="text-right">Net USD</th><th className="text-right">Net RON</th>
                </tr>
              </thead>
              <tbody>
                {payroll.rows.map((r) => (
                  <tr key={r.modelId}>
                    <td>
                      {payroll.closed ? (
                        <Link href={`/plati/${month}/${r.modelId}`} className="font-medium text-accent hover:underline">{r.stageName}</Link>
                      ) : (
                        <Link href={`/modele/${r.modelId}`} className="font-medium hover:underline">{r.stageName}</Link>
                      )}
                      <span className="block text-xs text-muted">{r.planName}</span>
                    </td>
                    <td className="tabular text-right">{formatUsd(r.grossCents)}</td>
                    <td className="tabular text-right text-muted">{formatPercent(r.percentBp)}</td>
                    <td className="tabular text-right">{formatUsd(r.shareCents)}</td>
                    <td className={`tabular text-right ${r.bonusCents ? 'text-good' : 'text-muted'}`}>{r.bonusCents ? `+${formatUsd(r.bonusCents)}` : '—'}</td>
                    <td className={`tabular text-right ${r.advanceCents ? 'text-bad' : 'text-muted'}`}>{r.advanceCents ? `−${formatUsd(r.advanceCents)}` : '—'}</td>
                    <td className={`tabular text-right ${r.deductionCents ? 'text-bad' : 'text-muted'}`}>{r.deductionCents ? `−${formatUsd(r.deductionCents)}` : '—'}</td>
                    <td className="tabular text-right font-semibold">{formatUsd(r.netCents)}</td>
                    <td className="tabular text-right">{formatRon(r.netBani)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Card title="Bonusuri, avansuri, rețineri">
            {adjustments.length ? (
              <ul className="mb-4 divide-y divide-line text-sm">
                {adjustments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="min-w-0">
                      <span className="font-medium">{a.model}</span> · {KIND_LABEL[a.kind]} <span className="tabular">{formatUsd(a.cents)}</span>
                      {a.note ? <span className="block truncate text-xs text-muted">{a.note}</span> : null}
                    </span>
                    {canWrite ? <DeleteButton remove={deleteAdjustment.bind(null, a.id)} /> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-4 text-sm text-muted">Nimic în {label}.</p>
            )}
            {canWrite ? <AdjustmentForm action={addAdjustment.bind(null, month)} models={models} /> : null}
          </Card>

          {can(me.role, 'payroll:close') ? (
            <Card title={payroll.closed ? 'Lună închisă' : 'Închidere lună'}>
              {payroll.closed ? (
                <div className="space-y-3 text-sm">
                  <p className="text-muted">Închisă pe {payroll.closedAt?.toLocaleDateString('ro-RO')}. Fluturașii se deschid din numele modelului.</p>
                  <ReopenForm action={reopenMonth.bind(null, month)} />
                </div>
              ) : (
                <CloseMonthForm action={closeMonth.bind(null, month)} defaultRate={formatRate(payroll.usdToRonE4)} label={label} />
              )}
            </Card>
          ) : null}
        </div>
      </div>
    </>
  )
}
