import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge, Card, Empty, PageHeader, Table } from '@/components/ui'
import { addDays, addMonths, currentMonth, dayLabel, monthLabel, shortTime, today } from '@/lib/dates'
import { db } from '@/lib/db'
import { earning, model, modelAlias, payslip, platform, room, scheduleEntry, shift, user } from '@/lib/db/schema'
import { formatRon, formatUsd } from '@/lib/money'
import { can } from '@/lib/roles'
import { modelScope } from '@/server/scope'
import { requirePermission } from '@/server/session'
import { addAlias, removeAlias, saveModel, setModelLogin, setModelLoginActive } from '../actions'
import { ModelForm } from '../model-form'
import { formOptions } from '../shared'
import { MODEL_STATUS } from '../status'
import { Aliases } from './aliases'
import { LoginCard } from './login-card'

export const metadata: Metadata = { title: 'Fișă model' }

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission('models:read')
  const { id } = await params
  if (!isUuid(id)) notFound()
  const m = await db.query.model.findFirst({ where: and(eq(model.id, id), modelScope(me)) })
  if (!m) notFound()

  const canWrite = can(me.role, 'models:write')
  const showMoney = can(me.role, 'earnings:read')
  const from = today()

  const [upcoming, aliases, platforms, login, trainer] = await Promise.all([
    db
      .select({ day: scheduleEntry.day, room: room.name, shift: shift.name, start: shift.startTime, end: shift.endTime })
      .from(scheduleEntry)
      .innerJoin(room, eq(room.id, scheduleEntry.roomId))
      .innerJoin(shift, eq(shift.id, scheduleEntry.shiftId))
      .where(and(eq(scheduleEntry.modelId, id), gte(scheduleEntry.day, from), lte(scheduleEntry.day, addDays(from, 13))))
      .orderBy(asc(scheduleEntry.day), asc(shift.sort)),
    db
      .select({ id: modelAlias.id, username: modelAlias.username, platform: platform.name })
      .from(modelAlias)
      .innerJoin(platform, eq(platform.id, modelAlias.platformId))
      .where(eq(modelAlias.modelId, id))
      .orderBy(asc(platform.name)),
    db.select({ id: platform.id, name: platform.name }).from(platform).where(eq(platform.active, true)).orderBy(asc(platform.sort), asc(platform.name)),
    m.userId ? db.query.user.findFirst({ where: eq(user.id, m.userId), columns: { email: true, active: true } }) : null,
    m.trainerId ? db.query.user.findFirst({ where: eq(user.id, m.trainerId), columns: { name: true } }) : null,
  ])

  const sixMonthsAgo = `${addMonths(currentMonth(), -5)}-01`
  const [months, slips] = showMoney
    ? await Promise.all([
        db
          .select({ month: sql<string>`to_char(${earning.day}, 'YYYY-MM')`, cents: sql<number>`sum(${earning.amountCents})::int` })
          .from(earning)
          .where(and(eq(earning.modelId, id), gte(earning.day, sixMonthsAgo)))
          .groupBy(sql`1`)
          .orderBy(sql`1 desc`),
        db.select().from(payslip).where(eq(payslip.modelId, id)).orderBy(desc(payslip.month)).limit(12),
      ])
    : [[], []]

  const s = MODEL_STATUS[m.status]
  return (
    <>
      <PageHeader title={m.stageName} subtitle={<Badge tone={s.tone}>{s.label}</Badge>} actions={<Link href="/modele" className="text-sm text-muted hover:text-text">← Toate modelele</Link>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card title="Date">
            {canWrite ? (
              <ModelForm action={saveModel.bind(null, id)} values={m} {...await formOptions()} submitLabel="Salvează" />
            ) : (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-muted">Telefon</dt><dd>{m.phone ?? '—'}</dd></div>
                <div><dt className="text-muted">Data începerii</dt><dd>{m.startDate ? dayLabel(m.startDate) : '—'}</dd></div>
                <div><dt className="text-muted">Trainer</dt><dd>{trainer?.name ?? '—'}</dd></div>
              </dl>
            )}
          </Card>

          <Card title="Program, următoarele 14 zile" actions={<Link href="/orar" className="text-xs text-accent">Orar →</Link>}>
            {upcoming.length === 0 ? (
              <Empty>Nicio tură programată.</Empty>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {upcoming.map((u) => (
                  <li key={`${u.day}-${u.shift}`} className="flex flex-wrap justify-between gap-2 py-2">
                    <span className="capitalize">{dayLabel(u.day)}</span>
                    <span className="text-muted">{u.shift} · {shortTime(u.start)}–{shortTime(u.end)} · {u.room}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {showMoney ? (
            <Card title="Încasări pe ultimele 6 luni">
              {months.length === 0 ? (
                <Empty>Nicio încasare înregistrată.</Empty>
              ) : (
                <Table>
                  <thead><tr><th>Luna</th><th className="text-right">Brut</th><th className="text-right">Fluturaș</th></tr></thead>
                  <tbody>
                    {months.map((r) => {
                      const slip = slips.find((x) => x.month === r.month)
                      return (
                        <tr key={r.month}>
                          <td className="capitalize"><Link className="text-accent hover:underline" href={`/incasari?m=${r.month}&model=${id}`}>{monthLabel(r.month)}</Link></td>
                          <td className="tabular text-right">{formatUsd(r.cents)}</td>
                          <td className="tabular text-right">
                            {slip ? <Link className="text-accent hover:underline" href={`/plati/${r.month}/${id}`}>{formatRon(slip.netBani)}</Link> : <span className="text-muted">luna deschisă</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </Table>
              )}
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          {canWrite ? (
            <Card title="Cont în aplicație">
              <LoginCard login={login ?? null} setLogin={setModelLogin.bind(null, id)} setActive={setModelLoginActive.bind(null, id)} />
            </Card>
          ) : null}
          <Card title="Utilizatori pe platforme">
            <Aliases aliases={aliases} platforms={platforms} add={addAlias.bind(null, id)} remove={removeAlias} canEdit={canWrite} />
          </Card>
        </div>
      </div>
    </>
  )
}
