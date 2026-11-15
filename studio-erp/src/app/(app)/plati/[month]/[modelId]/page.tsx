import { eq } from 'drizzle-orm'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PrintButton } from '@/components/print-button'
import { isMonth, monthLabel } from '@/lib/dates'
import { db } from '@/lib/db'
import { model } from '@/lib/db/schema'
import { formatPercent, formatRate, formatRon, formatUsd } from '@/lib/money'
import { can } from '@/lib/roles'
import { getPayroll } from '@/server/payroll'
import { getSettings } from '@/server/settings'
import { requireUser } from '@/server/session'

export const metadata: Metadata = { title: 'Fluturaș' }

/** Printable payslip. Staff with payroll access see any; a model sees only their own. */
export default async function PayslipPage({ params }: { params: Promise<{ month: string; modelId: string }> }) {
  const me = await requireUser()
  const { month, modelId } = await params
  if (!isMonth(month) || !/^[0-9a-f-]{36}$/i.test(modelId)) notFound()
  const m = await db.query.model.findFirst({ where: eq(model.id, modelId) })
  if (!m) notFound()
  const allowed = can(me.role, 'payroll:read') || (me.role === 'model' && m.userId === me.id)
  if (!allowed) notFound()

  const payroll = await getPayroll(month, { modelId })
  const r = payroll.rows[0]
  if (!payroll.closed || !r) notFound()
  const { studioName } = await getSettings()

  const line = (label: string, value: string, strong = false) => (
    <div className={`flex justify-between gap-4 border-b border-line py-2 ${strong ? 'font-semibold' : ''}`}>
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  )

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={me.role === 'model' ? '/' : `/plati?m=${month}`} className="text-sm text-muted hover:text-text">← Înapoi</Link>
        <PrintButton />
      </div>
      <article className="rounded-xl border border-line bg-panel p-6 print:border-0 print:p-0">
        <header className="mb-6">
          <div className="text-sm text-muted">{studioName}</div>
          <h1 className="text-xl font-semibold capitalize">Fluturaș · {monthLabel(month)}</h1>
          <p className="mt-1 text-sm">{m.legalName} <span className="text-muted">({m.stageName})</span></p>
        </header>
        {line('Încasări brute', formatUsd(r.grossCents))}
        {line(`Cota ta (${formatPercent(r.percentBp)}, ${r.planName})`, formatUsd(r.shareCents))}
        {r.bonusCents ? line('Bonusuri', `+${formatUsd(r.bonusCents)}`) : null}
        {r.advanceCents ? line('Avansuri primite', `−${formatUsd(r.advanceCents)}`) : null}
        {r.deductionCents ? line('Rețineri', `−${formatUsd(r.deductionCents)}`) : null}
        {line('Net de plată', formatUsd(r.netCents), true)}
        {line(`Echivalent RON (curs ${formatRate(payroll.usdToRonE4)})`, formatRon(r.netBani), true)}
        {m.iban && me.role !== 'model' ? <p className="mt-4 text-xs text-muted">Cont: {m.iban}</p> : null}
        <p className="mt-6 text-xs text-muted">Generat la închiderea lunii, {payroll.closedAt?.toLocaleDateString('ro-RO')}.</p>
      </article>
    </div>
  )
}
