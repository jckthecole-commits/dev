/** Calendar helpers. Days are ISO strings (YYYY-MM-DD), months YYYY-MM, all in the studio's time zone. */

export const STUDIO_TZ = 'Europe/Bucharest'

const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: STUDIO_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })

export const today = (now = new Date()) => ymd.format(now)
export const currentMonth = (now = new Date()) => today(now).slice(0, 7)

export function isDay(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = toDate(s)
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s)
}
export const isMonth = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s)

const toDate = (day: string) => new Date(`${day}T00:00:00Z`)
const fromDate = (d: Date) => d.toISOString().slice(0, 10)

export function addDays(day: string, n: number): string {
  const d = toDate(day)
  d.setUTCDate(d.getUTCDate() + n)
  return fromDate(d)
}

/** Monday of the week containing `day`. */
export function weekStart(day: string): string {
  const dow = (toDate(day).getUTCDay() + 6) % 7
  return addDays(day, -dow)
}

export const weekDays = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i))

export function monthRange(month: string): { first: string; last: string } {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const last = new Date(Date.UTC(y, m, 0))
  return { first: `${month}-01`, last: fromDate(last) }
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return fromDate(d).slice(0, 7)
}

export const monthDays = (month: string) => {
  const { first, last } = monthRange(month)
  const out: string[] = []
  for (let d = first; d <= last; d = addDays(d, 1)) out.push(d)
  return out
}

const dayLabelFmt = new Intl.DateTimeFormat('ro-RO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const monthLabelFmt = new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const weekdayFmt = new Intl.DateTimeFormat('ro-RO', { weekday: 'long', timeZone: 'UTC' })

export const dayLabel = (day: string) => dayLabelFmt.format(toDate(day))
export const weekdayLabel = (day: string) => weekdayFmt.format(toDate(day))
export const monthLabel = (month: string) => monthLabelFmt.format(toDate(`${month}-01`))
export const shortTime = (t: string) => t.slice(0, 5)
