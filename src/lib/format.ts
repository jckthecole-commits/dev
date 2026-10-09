/** Formatting helpers (ro-RO). Money is integer bani. */

const RON = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const RON0 = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 })

/** 28900 → "289 lei", 28950 → "289,50 lei" */
export function formatPrice(bani: number, opts: { decimals?: 'auto' | 'always' } = {}): string {
  const lei = bani / 100
  const whole = bani % 100 === 0
  const body = whole && opts.decimals !== 'always' ? RON0.format(lei) : RON.format(lei)
  return `${body} lei`
}

/** Signed price for add-ons: "+99 lei", "inclus" */
export function formatDelta(bani: number): string {
  if (bani === 0) return 'inclus'
  return `${bani > 0 ? '+' : '−'}${formatPrice(Math.abs(bani))}`
}

/** Lei (decimal) → bani */
export const toBani = (lei: number) => Math.round(lei * 100)
export const fromBani = (bani: number) => bani / 100

/** 52□18 145 — standard frame measurement notation (EN ISO 8624) */
export function formatFrameSize(p: { lensWidth: number; bridgeWidth: number; templeLength: number }) {
  return `${p.lensWidth}□${p.bridgeWidth} ${p.templeLength}`
}

export const TZ = 'Europe/Bucharest'

export function formatDate(d: Date | string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) {
  return new Intl.DateTimeFormat('ro-RO', { timeZone: TZ, ...opts }).format(new Date(d))
}

export function formatDateTime(d: Date | string) {
  return new Intl.DateTimeFormat('ro-RO', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d))
}

export function formatTime(d: Date | string) {
  return new Intl.DateTimeFormat('ro-RO', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(d))
}

export function pluralRo(n: number, one: string, few: string, many: string) {
  if (n === 1) return `${n} ${one}`
  const r = n % 100
  return `${n} ${n === 0 || (r >= 1 && r <= 19) ? few : many}`
}
