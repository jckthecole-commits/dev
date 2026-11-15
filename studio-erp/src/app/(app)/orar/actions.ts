'use server'

import { and, between, eq, sql } from 'drizzle-orm'
import { refresh } from 'next/cache'
import { fail, ok, type ActionState } from '@/lib/action'
import { addDays, isDay, weekStart } from '@/lib/dates'
import { db } from '@/lib/db'
import { model, room, scheduleEntry, shift } from '@/lib/db/schema'
import { audit } from '@/server/audit'
import { isUniqueViolation } from '@/server/db-errors'
import { requirePermission } from '@/server/session'

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s)

/** Puts a model in a room for a shift, or clears the slot when modelId is empty. */
export async function assignSlot(day: string, roomId: string, shiftId: string, modelId: string): Promise<ActionState> {
  const actor = await requirePermission('schedule:write')
  if (!isDay(day) || !isUuid(roomId) || !isUuid(shiftId) || (modelId && !isUuid(modelId))) return fail('Date invalide.')

  if (!modelId) {
    await db.delete(scheduleEntry).where(and(eq(scheduleEntry.day, day), eq(scheduleEntry.roomId, roomId), eq(scheduleEntry.shiftId, shiftId)))
    await audit(actor, 'schedule.clear', 'schedule', `${day}/${roomId}/${shiftId}`)
    refresh()
    return ok()
  }

  const elsewhere = await db
    .select({ room: room.name })
    .from(scheduleEntry)
    .innerJoin(room, eq(room.id, scheduleEntry.roomId))
    .where(and(eq(scheduleEntry.day, day), eq(scheduleEntry.shiftId, shiftId), eq(scheduleEntry.modelId, modelId), sql`${scheduleEntry.roomId} <> ${roomId}`))
  if (elsewhere[0]) return fail(`Modelul e deja în ${elsewhere[0].room} în această tură.`)
  const m = await db.query.model.findFirst({ where: eq(model.id, modelId), columns: { status: true } })
  if (!m || m.status === 'left') return fail('Modelul nu mai e activ.')

  try {
    await db
      .insert(scheduleEntry)
      .values({ day, roomId, shiftId, modelId })
      .onConflictDoUpdate({ target: [scheduleEntry.day, scheduleEntry.roomId, scheduleEntry.shiftId], set: { modelId, updatedAt: new Date() } })
  } catch (e) {
    // someone else put this model in another room for the same shift a moment ago
    if (isUniqueViolation(e)) return fail('Modelul e deja în altă cameră în această tură.')
    throw e
  }
  await audit(actor, 'schedule.assign', 'schedule', `${day}/${roomId}/${shiftId}`, { modelId })
  refresh()
  return ok()
}

/** Copies last week's schedule into this week, filling only empty slots and skipping clashes. */
export async function copyPreviousWeek(monday: string, _prev: ActionState, _f: FormData): Promise<ActionState> {
  const actor = await requirePermission('schedule:write')
  if (!isDay(monday)) return fail('Dată invalidă.')
  const start = weekStart(monday)
  const prevStart = addDays(start, -7)
  const prev = await db
    .select({ day: scheduleEntry.day, roomId: scheduleEntry.roomId, shiftId: scheduleEntry.shiftId, modelId: scheduleEntry.modelId })
    .from(scheduleEntry)
    .innerJoin(model, eq(model.id, scheduleEntry.modelId))
    .innerJoin(room, eq(room.id, scheduleEntry.roomId))
    .innerJoin(shift, eq(shift.id, scheduleEntry.shiftId))
    .where(and(between(scheduleEntry.day, prevStart, addDays(prevStart, 6)), sql`${model.status} in ('active','onboarding')`, eq(room.active, true), eq(shift.active, true)))
  if (!prev.length) return fail('Săptămâna trecută e goală.')
  const inserted = await db
    .insert(scheduleEntry)
    .values(prev.map((p) => ({ ...p, day: addDays(p.day, 7) })))
    .onConflictDoNothing()
    .returning({ id: scheduleEntry.id })
  await audit(actor, 'schedule.copy-week', 'schedule', start, { copied: inserted.length })
  refresh()
  return ok(inserted.length ? `Am copiat ${inserted.length} ${inserted.length === 1 ? 'tură' : 'ture'}.` : 'Nimic de copiat: sloturile erau deja ocupate.')
}
