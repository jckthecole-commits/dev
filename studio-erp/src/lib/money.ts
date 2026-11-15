/** Money helpers. All amounts are integer minor units (US cents, RON bani). */

const usd = new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
const ron = new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON', minimumFractionDigits: 2 })

export const formatUsd = (cents: number) => usd.format(cents / 100)
export const formatRon = (bani: number) => ron.format(bani / 100)
export const formatPercent = (bp: number) => `${(bp / 100).toLocaleString('ro-RO', { maximumFractionDigits: 2 })}%`

/**
 * Parses a human-typed amount into minor units. Accepts "1234.5", "1234,50", "1.234,50", "1,234.50", "$1 234".
 * A single separator followed by exactly three digits ("1.234", "1,234") groups thousands.
 * Returns null for anything that isn't a plain non-negative amount with at most two decimals.
 */
export function parseAmount(input: string): number | null {
  const s = input.trim().replace(/[\s$€]|USD|RON|lei/gi, '')
  if (!/^[\d.,]+$/.test(s)) return null
  const commas = s.split(',').length - 1
  const dots = s.split('.').length - 1
  let dec: ',' | '.' | null = null
  if (commas && dots) dec = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.'
  else if (commas === 1 || dots === 1) {
    const sep = commas ? ',' : '.'
    dec = s.split(sep)[1]!.length === 3 ? null : sep
  }
  const thousands = dec === ',' ? '.' : dec === '.' ? ',' : commas ? ',' : dots ? '.' : null
  const [intPart = '', frac = '', ...rest] = dec ? s.split(dec) : [s]
  if (rest.length || (dec && !/^\d{1,2}$/.test(frac))) return null
  if (thousands && intPart.includes(thousands) && !new RegExp(`^\\d{1,3}(\\${thousands}\\d{3})+$`).test(intPart)) return null
  const whole = thousands ? intPart.split(thousands).join('') : intPart
  if (!/^\d+$/.test(whole)) return null
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'))
  return Number.isSafeInteger(cents) ? cents : null
}

/** Parses a percentage ("50", "52,5", "50%") into basis points. */
export function parsePercent(input: string): number | null {
  const s = input.trim().replace('%', '').replace(',', '.')
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null
  const bp = Math.round(Number(s) * 100)
  return bp <= 10000 ? bp : null
}

/** Parses an exchange rate ("4,9712") into RON per USD × 10 000. */
export function parseRate(input: string): number | null {
  const s = input.trim().replace(',', '.')
  if (!/^\d{1,3}(\.\d{1,4})?$/.test(s)) return null
  const e4 = Math.round(Number(s) * 10000)
  return e4 > 0 ? e4 : null
}

export const formatRate = (e4: number) => (e4 / 10000).toLocaleString('ro-RO', { minimumFractionDigits: 4 })
