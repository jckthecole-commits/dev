/** Time zone helpers for Europe/Bucharest without a date library. */
import { TZ } from './format'

const dtf = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
})

export type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number }

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

export function zonedParts(date: Date): ZonedParts {
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]))
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: WD[p.weekday as string] ?? 0,
  }
}

function offsetMinutes(date: Date): number {
  const p = zonedParts(date)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUtc - date.getTime()) / 60000)
}

/** "2026-10-12" + "10:30" (Bucharest wall time) → UTC Date */
export function zonedToUtc(day: string, time: string): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  const [hh, mm] = time.split(':').map(Number) as [number, number]
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const off1 = offsetMinutes(new Date(guess))
  let utc = guess - off1 * 60000
  const off2 = offsetMinutes(new Date(utc))
  if (off2 !== off1) utc = guess - off2 * 60000
  return new Date(utc)
}

/** UTC Date → "YYYY-MM-DD" in Bucharest */
export function zonedDay(date: Date): string {
  const p = zonedParts(date)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** "HH:MM" in Bucharest */
export function zonedTime(date: Date): string {
  const p = zonedParts(date)
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}

export function weekdayOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  return h * 60 + m
}
export const fromMinutes = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
