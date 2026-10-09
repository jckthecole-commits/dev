import { and, asc, gte, lt } from 'drizzle-orm'
import Link from 'next/link'
import { Suspense } from 'react'
import { addScheduleException, removeScheduleException, saveStaffNote, setAppointmentStatus } from '@/app/admin/_actions/agenda'
import { ActionButton } from '@/components/admin/action-button'
import { AdminForm } from '@/components/admin/form'
import { Badge, Empty, Field, input, PageHeader, Panel, type Tone } from '@/components/admin/ui'
import { Icon } from '@/components/icons'
import { hoursFor } from '@/lib/booking'
import { db } from '@/lib/db'
import { appointment, scheduleException } from '@/lib/db/schema'
import { formatDate, formatTime } from '@/lib/format'
import { formatPhone } from '@/lib/ro'
import { addDays, weekdayOf, zonedDay, zonedToUtc } from '@/lib/time'
import { can, requireStaff } from '@/server/session'
import { getSettings } from '@/server/settings'

export const metadata = { title: 'Programări' }

const A_STATUS: Record<string, { label: string; tone: Tone }> = {
  booked: { label: 'Rezervată', tone: 'info' },
  confirmed: { label: 'Confirmată', tone: 'ok' },
  completed: { label: 'Efectuată', tone: 'neutral' },
  no_show: { label: 'Neprezentat', tone: 'warn' },
  cancelled: { label: 'Anulată', tone: 'err' },
}
const NEXT: Record<string, { to: keyof typeof A_STATUS; label: string; variant: 'primary' | 'secondary' | 'ghost' | 'danger' }[]> = {
  booked: [{ to: 'confirmed', label: 'Confirmă', variant: 'primary' }, { to: 'cancelled', label: 'Anulează', variant: 'ghost' }],
  confirmed: [{ to: 'completed', label: 'Efectuată', variant: 'primary' }, { to: 'no_show', label: 'Nu a venit', variant: 'secondary' }, { to: 'cancelled', label: 'Anulează', variant: 'ghost' }],
  completed: [],
  no_show: [{ to: 'booked', label: 'Redeschide', variant: 'ghost' }],
  cancelled: [{ to: 'booked', label: 'Redeschide', variant: 'ghost' }],
}

export default function Agenda({ searchParams }: Pick<PageProps<'/admin/programari'>, 'searchParams'>) {
  return (
    <Suspense fallback={<div className="skeleton h-[560px]" />}>
      <Week searchParams={searchParams} />
    </Suspense>
  )
}

async function Week({ searchParams }: Pick<PageProps<'/admin/programari'>, 'searchParams'>) {
  const me = await requireStaff('orders:read')
  const sp = await searchParams
  const today = zonedDay(new Date())
  const anchor = typeof sp.saptamana === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.saptamana) ? sp.saptamana : today
  const monday = addDays(anchor, -((weekdayOf(anchor) + 6) % 7))
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const writable = can(me.role, 'appointments:write')

  const [appts, exceptions, settings] = await Promise.all([
    db.query.appointment.findMany({ where: and(gte(appointment.startsAt, zonedToUtc(monday, '00:00')), lt(appointment.startsAt, zonedToUtc(addDays(monday, 7), '00:00'))), with: { service: true }, orderBy: asc(appointment.startsAt) }),
    db.select().from(scheduleException).where(gte(scheduleException.day, monday < today ? monday : today)).orderBy(asc(scheduleException.day)).limit(30),
    getSettings(),
  ])
  const allExceptions = exceptions.map((e) => ({ day: e.day, closed: e.closed, opens: e.opens, closes: e.closes }))
  const byDay = (d: string) => appts.filter((a) => zonedDay(a.startsAt) === d)
  const active = appts.filter((a) => a.status !== 'cancelled').length
  const fmtRange = `${formatDate(`${monday}T12:00:00Z`, { day: 'numeric', month: 'long' })} – ${formatDate(`${addDays(monday, 6)}T12:00:00Z`, { day: 'numeric', month: 'long', year: 'numeric' })}`

  return (
    <>
      <PageHeader
        eyebrow={`Agenda showroom · ${active} programări`}
        title={fmtRange}
        actions={
          <>
            <Link href={`/admin/programari?saptamana=${addDays(monday, -7)}`} className="btn btn-secondary btn-sm" aria-label="Săptămâna anterioară">←</Link>
            <Link href="/admin/programari" className="btn btn-secondary btn-sm">Azi</Link>
            <Link href={`/admin/programari?saptamana=${addDays(monday, 7)}`} className="btn btn-secondary btn-sm" aria-label="Săptămâna următoare">→</Link>
          </>
        }
      />

      <ol className="mb-8 grid grid-cols-7 gap-2">
        {days.map((d) => {
          const h = hoursFor(d, settings.hours.weekly, allExceptions)
          const n = byDay(d).filter((a) => a.status !== 'cancelled').length
          return (
            <li key={d}>
              <a href={`#zi-${d}`} className={`flex h-full flex-col rounded-2xl p-3 no-underline ring-1 ${d === today ? 'bg-ink text-fog ring-ink' : h ? 'bg-glass ring-line-soft hover:ring-line' : 'bg-transparent text-graphite ring-line-soft'}`}>
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] opacity-75">{formatDate(`${d}T12:00:00Z`, { weekday: 'short' })}</span>
                <span className="font-display text-[26px] font-bold leading-tight tnum">{Number(d.slice(8))}</span>
                <span className="mt-auto hidden text-[12px] opacity-80 sm:block">{h ? `${h.open}–${h.close}` : 'închis'}</span>
                <span className="mt-1 text-[12.5px] font-bold tnum">{n ? `${n} prog.` : ' '}</span>
              </a>
            </li>
          )
        })}
      </ol>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="flex flex-col gap-6">
          {days.map((d) => {
            const list = byDay(d)
            const h = hoursFor(d, settings.hours.weekly, allExceptions)
            if (!list.length && d !== today) return null
            return (
              <Panel key={d} title={`${formatDate(`${d}T12:00:00Z`, { weekday: 'long', day: 'numeric', month: 'long' })}${d === today ? ' · azi' : ''}`} action={<span className="spec">{h ? `${h.open}–${h.close}` : 'închis'}</span>} pad={false}>
                <div id={`zi-${d}`} className="scroll-mt-20" />
                {list.length ? (
                  <ul className="divide-y divide-line-soft">
                    {list.map((a) => (
                      <li key={a.id} className={`grid gap-3 p-5 sm:grid-cols-[72px_1fr] ${a.status === 'cancelled' ? 'opacity-55' : ''}`}>
                        <div>
                          <div className="font-mono text-[17px] font-medium tnum">{formatTime(a.startsAt)}</div>
                          <div className="spec">{a.service.durationMin} min</div>
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold">{a.name}</span>
                            <Badge tone={A_STATUS[a.status]!.tone}>{A_STATUS[a.status]!.label}</Badge>
                            <span className="text-[13.5px] text-graphite">{a.service.name}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-4 text-[13.5px]">
                            <a href={`tel:${a.phone}`} className="text-ink">{formatPhone(a.phone)}</a>
                            <a href={`mailto:${a.email}`} className="text-cobalt">{a.email}</a>
                          </div>
                          {a.note ? <p className="mt-2 rounded-xl bg-fog px-3 py-2 text-[13.5px]">„{a.note}”</p> : null}
                          {writable ? (
                            <div className="mt-3 flex flex-wrap items-start gap-2">
                              {NEXT[a.status]!.map((n) => (
                                <ActionButton key={n.to} action={setAppointmentStatus.bind(null, a.id, n.to as 'booked')} variant={n.variant} confirm={n.to === 'cancelled' ? 'Anulezi programarea? Clientul primește e-mail.' : undefined}>
                                  {n.label}
                                </ActionButton>
                              ))}
                              <details className="group ml-auto">
                                <summary className="btn btn-ghost btn-sm">{a.staffNote ? 'Notă internă ✓' : 'Notă internă'}</summary>
                                <div className="mt-2 w-[min(420px,80vw)]">
                                  <AdminForm action={saveStaffNote.bind(null, a.id)}>
                                    <textarea name="staffNote" rows={3} defaultValue={a.staffNote ?? ''} className="field h-auto py-2 text-[14px]" aria-label="Notă internă" />
                                  </AdminForm>
                                </div>
                              </details>
                            </div>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty icon="calendar" title="Nicio programare azi" />
                )}
              </Panel>
            )
          })}
          {appts.length === 0 ? <Panel><Empty icon="calendar" title="Săptămână liberă">Nicio programare între {fmtRange}.</Empty></Panel> : null}
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Program săptămânal" action={<Link href="/admin/setari#hours" className="text-[13.5px] font-bold text-cobalt">Modifică</Link>}>
            <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-[14px]">
              {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
                const h = settings.hours.weekly.find((x) => x.day === wd)
                return (
                  <div key={wd} className="contents">
                    <dt className="capitalize">{new Intl.DateTimeFormat('ro-RO', { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 7 + wd)))}</dt>
                    <dd className="text-right font-mono tnum">{!h || 'closed' in h ? 'închis' : `${h.open}–${h.close}`}</dd>
                  </div>
                )
              })}
            </dl>
          </Panel>

          <Panel title="Zile cu program special">
            {writable ? (
              <AdminForm action={addScheduleException} submit="Adaugă">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Ziua" className="col-span-2 sm:col-span-1"><input type="date" name="day" min={today} required className={input} /></Field>
                  <Field label="Tip" className="col-span-2 sm:col-span-1">
                    <select name="mode" className={input} defaultValue="closed"><option value="closed">Închis</option><option value="hours">Program redus / special</option></select>
                  </Field>
                  <Field label="Deschide"><input type="time" name="opens" className={input} /></Field>
                  <Field label="Închide"><input type="time" name="closes" className={input} /></Field>
                  <Field label="Motiv (intern)" className="col-span-2"><input name="note" className={input} placeholder="ex. 1 Decembrie, inventar" /></Field>
                </div>
              </AdminForm>
            ) : null}
            <ul className="mt-5 flex flex-col divide-y divide-line-soft text-[14px]">
              {exceptions.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span>
                    <strong>{formatDate(`${e.day}T12:00:00Z`, { weekday: 'short', day: 'numeric', month: 'short' })}</strong> · {e.closed ? 'închis' : `${e.opens}–${e.closes}`}
                    {e.note ? <span className="block text-[12.5px] text-graphite">{e.note}</span> : null}
                  </span>
                  {writable ? <ActionButton action={removeScheduleException.bind(null, e.id)} variant="ghost"><Icon name="trash" size={15} /></ActionButton> : null}
                </li>
              ))}
              {exceptions.length === 0 ? <li className="py-2 text-graphite">Nicio excepție planificată.</li> : null}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  )
}
