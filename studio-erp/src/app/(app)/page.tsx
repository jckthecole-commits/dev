import { and, asc, between, desc, eq, gte, lte, sql } from 'drizzle-orm'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, Empty, PageHeader, Stat, Table } from '@/components/ui'
import { addDays, addMonths, currentMonth, dayLabel, monthDays, monthLabel, monthRange, shortTime, today } from '@/lib/dates'
import { db } from '@/lib/db'
import { earning, model, payslip, room, scheduleEntry, shift } from '@/lib/db/schema'
import { formatRon, formatUsd } from '@/lib/money'
import { can } from '@/lib/roles'
import { modelScope } from '@/server/scope'
import { requireUser, type SessionUser } from '@/server/session'
import { DailyChart } from './daily-chart'

export const metadata: Metadata = { title: 'Acasă' }

export default async function Home() {
  const me = await requireUser()
  return me.role === 'model' ? <ModelPortal me={me} /> : <Dashboard me={me} />
}

async function todaysSchedule(day: string, where?: ReturnType<typeof eq>) {
  return db
    .select({ shift: shift.name, start: shift.startTime, end: shift.endTime, room: room.name, model: model.stageName, modelId: model.id, day: scheduleEntry.day })
    .from(scheduleEntry)
    .innerJoin(shift, eq(shift.id, scheduleEntry.shiftId))
    .innerJoin(room, eq(room.id, scheduleEntry.roomId))
    .innerJoin(model, eq(model.id, scheduleEntry.modelId))
    .where(and(eq(scheduleEntry.day, day), where))
    .orderBy(asc(shift.sort), asc(shift.startTime), asc(room.sort), asc(room.name))
}

async function Dashboard({ me }: { me: SessionUser }) {
  const day = today()
  const month = currentMonth()
  const { first, last } = monthRange(month)
  const prev = monthRange(addMonths(month, -1))
  const money = can(me.role, 'earnings:read')
  const scope = modelScope(me)

  const [schedule, counts] = await Promise.all([
    todaysSchedule(day, me.role === 'trainer' ? eq(model.trainerId, me.id) : undefined),
    db
      .select({ active: sql<number>`count(*) filter (where ${model.status} = 'active')::int`, onboarding: sql<number>`count(*) filter (where ${model.status} = 'onboarding')::int` })
      .from(model)
      .where(scope),
  ])

  let money$: null | { daily: { day: string; cents: number }[]; total: number; prevSamePeriod: number; top: { id: string; name: string; cents: number }[] } = null
  if (money) {
    const dayOfMonth = Number(day.slice(8, 10))
    const prevCut = addDays(prev.first, Math.min(dayOfMonth, Number(prev.last.slice(8, 10))) - 1)
    const [daily, prevSum, top] = await Promise.all([
      db.select({ day: earning.day, cents: sql<number>`sum(${earning.amountCents})::int` }).from(earning).where(between(earning.day, first, last)).groupBy(earning.day),
      db.select({ cents: sql<number>`coalesce(sum(${earning.amountCents}), 0)::int` }).from(earning).where(between(earning.day, prev.first, prevCut)),
      db
        .select({ id: model.id, name: model.stageName, cents: sql<number>`sum(${earning.amountCents})::int` })
        .from(earning)
        .innerJoin(model, eq(model.id, earning.modelId))
        .where(between(earning.day, first, last))
        .groupBy(model.id, model.stageName)
        .orderBy(sql`3 desc`)
        .limit(8),
    ])
    const byDay = new Map(daily.map((d) => [d.day, d.cents]))
    money$ = {
      daily: monthDays(month).map((d) => ({ day: d, cents: byDay.get(d) ?? 0 })),
      total: daily.reduce((a, d) => a + d.cents, 0),
      prevSamePeriod: prevSum[0]?.cents ?? 0,
      top,
    }
  }
  const c = counts[0]!
  const trend = money$ && money$.prevSamePeriod > 0 ? Math.round(((money$.total - money$.prevSamePeriod) / money$.prevSamePeriod) * 100) : null

  return (
    <>
      <PageHeader title={`Bună, ${me.name.split(' ')[0]}`} subtitle={<span className="capitalize">{dayLabel(day)}</span>} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {money$ ? <Stat label={`Brut ${monthLabel(month)}`} value={formatUsd(money$.total)} hint={trend === null ? 'fără date luna trecută' : `${trend >= 0 ? '+' : ''}${trend}% față de aceeași perioadă`} /> : null}
        {money$ ? <Stat label="Medie pe zi" value={formatUsd(Math.round(money$.total / Number(day.slice(8, 10))))} hint="până azi" /> : null}
        <Stat label="Modele active" value={c.active} hint={c.onboarding ? `+${c.onboarding} în pregătire` : undefined} />
        <Stat label="Ture azi" value={schedule.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          {money$ ? (
            <Card title="Încasări pe zile" actions={<Link href="/incasari" className="text-xs text-accent">Detalii →</Link>}>
              <DailyChart data={money$.daily} today={day} />
            </Card>
          ) : null}
          <Card title="Azi în camere" actions={<Link href="/orar" className="text-xs text-accent">Orar →</Link>}>
            {schedule.length === 0 ? (
              <Empty>Nimeni programat azi.</Empty>
            ) : (
              <Table>
                <thead><tr><th>Tura</th><th>Camera</th><th>Model</th></tr></thead>
                <tbody>
                  {schedule.map((s) => (
                    <tr key={`${s.shift}-${s.room}`}>
                      <td className="whitespace-nowrap">{s.shift} <span className="text-muted">{shortTime(s.start)}–{shortTime(s.end)}</span></td>
                      <td>{s.room}</td>
                      <td><Link href={`/modele/${s.modelId}`} className="hover:underline">{s.model}</Link></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
        {money$ ? (
          <Card title="Top luna aceasta">
            {money$.top.length === 0 ? (
              <p className="text-sm text-muted">Nicio încasare încă.</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {money$.top.map((t, i) => (
                  <li key={t.id} className="flex items-center gap-3">
                    <span className="tabular w-5 text-muted">{i + 1}.</span>
                    <Link href={`/modele/${t.id}`} className="min-w-0 flex-1 truncate hover:underline">{t.name}</Link>
                    <span className="tabular">{formatUsd(t.cents)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        ) : null}
      </div>
    </>
  )
}

async function ModelPortal({ me }: { me: SessionUser }) {
  const m = await db.query.model.findFirst({ where: eq(model.userId, me.id) })
  if (!m) {
    return (
      <>
        <PageHeader title={`Bună, ${me.name}`} />
        <Empty>Contul tău nu e încă legat de o fișă. Anunță administratorul.</Empty>
      </>
    )
  }
  const day = today()
  const month = currentMonth()
  const { first, last } = monthRange(month)
  const [upcoming, monthly, slips] = await Promise.all([
    db
      .select({ day: scheduleEntry.day, shift: shift.name, start: shift.startTime, end: shift.endTime, room: room.name })
      .from(scheduleEntry)
      .innerJoin(shift, eq(shift.id, scheduleEntry.shiftId))
      .innerJoin(room, eq(room.id, scheduleEntry.roomId))
      .where(and(eq(scheduleEntry.modelId, m.id), gte(scheduleEntry.day, day), lte(scheduleEntry.day, addDays(day, 13))))
      .orderBy(asc(scheduleEntry.day), asc(shift.sort)),
    db
      .select({ cents: sql<number>`coalesce(sum(${earning.amountCents}), 0)::int`, minutes: sql<number>`coalesce(sum(${earning.minutes}), 0)::int`, days: sql<number>`count(distinct ${earning.day})::int` })
      .from(earning)
      .where(and(eq(earning.modelId, m.id), between(earning.day, first, last))),
    db.select().from(payslip).where(eq(payslip.modelId, m.id)).orderBy(desc(payslip.month)).limit(12),
  ])
  const t = monthly[0]!
  return (
    <>
      <PageHeader title={`Bună, ${m.stageName}`} subtitle={<span className="capitalize">{dayLabel(day)}</span>} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label={`Încasări ${monthLabel(month)}`} value={formatUsd(t.cents)} hint="brut, până acum" />
        <Stat label="Zile lucrate" value={t.days} />
        <Stat label="Ore online" value={(t.minutes / 60).toLocaleString('ro-RO', { maximumFractionDigits: 1 })} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Programul tău, următoarele 14 zile">
          {upcoming.length === 0 ? (
            <Empty>Nicio tură programată.</Empty>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {upcoming.map((u) => (
                <li key={`${u.day}-${u.shift}`} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className={u.day === day ? 'font-semibold text-accent capitalize' : 'capitalize'}>{u.day === day ? 'Azi' : dayLabel(u.day)}</span>
                  <span className="text-muted">{u.shift} · {shortTime(u.start)}–{shortTime(u.end)} · {u.room}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Fluturașii tăi">
          {slips.length === 0 ? (
            <Empty>Niciun fluturaș încă.</Empty>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {slips.map((s) => (
                <li key={s.id} className="flex justify-between gap-2 py-2">
                  <Link href={`/plati/${s.month}/${m.id}`} className="capitalize text-accent hover:underline">{monthLabel(s.month)}</Link>
                  <span className="tabular">{formatRon(s.netBani)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
