/**
 * Appointment slot engine — pure, timezone-aware (Europe/Bucharest), unit-tested.
 */
import type { DayHours } from './settings-schema'
import { addDays, fromMinutes, toMinutes, weekdayOf, zonedToUtc } from './time'

export type Busy = { startsAt: Date; endsAt: Date; serviceCode: string }
export type Exception = { day: string; closed: boolean; opens: string | null; closes: string | null }
export type SlotService = { code: string; durationMin: number; capacity: number }

export function hoursFor(day: string, weekly: DayHours[], exceptions: Exception[]): { open: string; close: string } | null {
  const ex = exceptions.find((e) => e.day === day)
  if (ex) {
    if (ex.closed || !ex.opens || !ex.closes) return null
    return { open: ex.opens, close: ex.closes }
  }
  const wd = weekdayOf(day)
  const d = weekly.find((h) => h.day === wd)
  if (!d || 'closed' in d) return null
  return { open: d.open, close: d.close }
}

/**
 * Available start times for a service on a day.
 * - Slots on a `step`-minute grid, the whole appointment must fit before closing.
 * - At most `capacity` overlapping bookings of the same service; consultations
 *   (capacity 1) also block other single-capacity services (one optometrist).
 * - No slot earlier than `now + leadMinutes`.
 */
export function slotsForDay(opts: { day: string; service: SlotService; weekly: DayHours[]; exceptions: Exception[]; busy: Busy[]; step: number; now: Date; leadMinutes: number; exclusiveCodes?: string[] }): string[] {
  const hours = hoursFor(opts.day, opts.weekly, opts.exceptions)
  if (!hours) return []
  const open = toMinutes(hours.open)
  const close = toMinutes(hours.close)
  const earliest = opts.now.getTime() + opts.leadMinutes * 60000
  const exclusive = new Set(opts.exclusiveCodes ?? [])
  const out: string[] = []
  for (let m = open; m + opts.service.durationMin <= close; m += opts.step) {
    const start = zonedToUtc(opts.day, fromMinutes(m))
    if (start.getTime() < earliest) continue
    const end = new Date(start.getTime() + opts.service.durationMin * 60000)
    const overlapping = opts.busy.filter((b) => b.startsAt < end && b.endsAt > start)
    const sameService = overlapping.filter((b) => b.serviceCode === opts.service.code).length
    const blockedByExclusive = exclusive.has(opts.service.code) && overlapping.some((b) => exclusive.has(b.serviceCode))
    if (sameService < opts.service.capacity && !blockedByExclusive) out.push(fromMinutes(m))
  }
  return out
}

export function nextDays(fromDay: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(fromDay, i))
}

/** iCalendar (RFC 5545) event for the confirmation e-mail. */
export function icsEvent(o: { uid: string; start: Date; end: Date; title: string; description: string; location: string; url?: string }) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sifra Vision//Programari//RO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${o.uid}@sifravision.ro`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(o.start)}`,
    `DTEND:${fmt(o.end)}`,
    `SUMMARY:${esc(o.title)}`,
    `DESCRIPTION:${esc(o.description)}`,
    `LOCATION:${esc(o.location)}`,
    ...(o.url ? [`URL:${o.url}`] : []),
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Programare Sifra Vision',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}
