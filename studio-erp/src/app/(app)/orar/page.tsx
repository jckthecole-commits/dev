import { and, asc, between, eq, inArray, sql } from 'drizzle-orm'
import type { Metadata } from 'next'
import { ActionForm } from '@/components/action-form'
import { Button, Card, Empty, LinkButton, PageHeader, PeriodNav, cn } from '@/components/ui'
import { addDays, dayLabel, isDay, shortTime, today, weekDays, weekStart } from '@/lib/dates'
import { db } from '@/lib/db'
import { model, room, scheduleEntry, shift } from '@/lib/db/schema'
import { can } from '@/lib/roles'
import { requirePermission } from '@/server/session'
import { assignSlot, copyPreviousWeek } from './actions'
import { Slot } from './slot'

export const metadata: Metadata = { title: 'Orar camere' }

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const me = await requirePermission('schedule:read')
  const { w } = await searchParams
  const now = today()
  const monday = weekStart(isDay(w) ? w : now)
  const days = weekDays(monday)
  const canEdit = can(me.role, 'schedule:write')

  const [rooms, shifts, entries, models] = await Promise.all([
    db.select().from(room).where(eq(room.active, true)).orderBy(asc(room.sort), asc(room.name)),
    db.select().from(shift).where(eq(shift.active, true)).orderBy(asc(shift.sort), asc(shift.startTime)),
    db
      .select({ day: scheduleEntry.day, roomId: scheduleEntry.roomId, shiftId: scheduleEntry.shiftId, modelId: scheduleEntry.modelId, name: model.stageName })
      .from(scheduleEntry)
      .innerJoin(model, eq(model.id, scheduleEntry.modelId))
      .where(between(scheduleEntry.day, days[0]!, days[6]!)),
    db
      .select({ id: model.id, name: model.stageName })
      .from(model)
      .where(and(inArray(model.status, ['active', 'onboarding'])))
      .orderBy(sql`lower(${model.stageName})`),
  ])
  const at = (day: string, roomId: string, shiftId: string) => entries.find((e) => e.day === day && e.roomId === roomId && e.shiftId === shiftId)
  const filled = entries.length
  const capacity = rooms.length * shifts.length * 7

  return (
    <>
      <PageHeader
        title="Orar camere"
        subtitle={`${filled} din ${capacity} sloturi ocupate săptămâna aceasta`}
        actions={
          <>
            <PeriodNav prev={`/orar?w=${addDays(monday, -7)}`} next={`/orar?w=${addDays(monday, 7)}`} label={`${dayLabel(days[0]!)} – ${dayLabel(days[6]!)}`} current="/orar" />
            {canEdit ? (
              <ActionForm action={copyPreviousWeek.bind(null, monday)} confirm="Copiez orarul săptămânii trecute în sloturile libere?">
                <Button type="submit" variant="secondary" small>Copiază săptămâna trecută</Button>
              </ActionForm>
            ) : null}
          </>
        }
      />
      {rooms.length === 0 || shifts.length === 0 ? (
        <Empty>
          Definește întâi camerele și turele în Setări.{' '}
          {can(me.role, 'settings:write') ? <LinkButton href="/setari" small>Setări</LinkButton> : null}
        </Empty>
      ) : (
        <div className="space-y-6">
          {shifts.map((s) => (
            <Card key={s.id} title={`${s.name} · ${shortTime(s.startTime)}–${shortTime(s.endTime)}`}>
              <div className="-mx-4 overflow-x-auto px-4">
                <table className="border-separate border-spacing-1 text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-panel pr-2 text-left text-xs font-medium text-muted">Camera</th>
                      {days.map((d) => (
                        <th key={d} className={cn('px-1 text-left text-xs font-medium capitalize', d === now ? 'text-accent' : 'text-muted')}>{dayLabel(d)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map((r) => (
                      <tr key={r.id}>
                        <th className="sticky left-0 z-10 bg-panel pr-2 text-left font-medium whitespace-nowrap">{r.name}</th>
                        {days.map((d) => {
                          const e = at(d, r.id, s.id)
                          return (
                            <td key={d}>
                              {canEdit ? (
                                <Slot
                                  value={e?.modelId ?? ''}
                                  models={e && !models.some((m) => m.id === e.modelId) ? [...models, { id: e.modelId, name: e.name }] : models}
                                  label={`${r.name}, ${s.name}, ${dayLabel(d)}`}
                                  assign={assignSlot.bind(null, d, r.id, s.id)}
                                />
                              ) : (
                                <div className={cn('flex h-9 w-32 items-center rounded-md px-2 text-xs', e ? 'bg-accent/10' : 'bg-panel-2 text-muted')}>{e?.name ?? '—'}</div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
