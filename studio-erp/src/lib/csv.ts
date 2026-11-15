import { isDay } from './dates'
import { parseAmount } from './money'

/**
 * Splits CSV/TSV text into rows. Handles quoted fields ("a,b", "say ""hi"""), CRLF, and picks the
 * delimiter (comma, semicolon or tab) from the header line.
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const header = src.split(/\r?\n/, 1)[0] ?? ''
  const delim = ['\t', ';', ','].map((d) => ({ d, n: header.split(d).length })).sort((a, b) => b.n - a.n)[0]!.d
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"' && field === '') quoted = true
    else if (c === delim) {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.map((r) => r.map((f) => f.trim())).filter((r) => r.some((f) => f !== ''))
}

export type EarningRow = { line: number; model: string; platform: string; day: string; amountCents: number; minutes: number | null }
export type RowError = { line: number; message: string }

const HEADERS: Record<string, keyof Omit<EarningRow, 'line' | 'amountCents'> | 'amount'> = {
  model: 'model', username: 'model', user: 'model', nume: 'model',
  platforma: 'platform', platform: 'platform', site: 'platform',
  data: 'day', date: 'day', zi: 'day', day: 'day',
  suma: 'amount', amount: 'amount', usd: 'amount', castig: 'amount', earnings: 'amount', total: 'amount',
  minute: 'minutes', minutes: 'minutes', online: 'minutes',
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')

/** Accepts YYYY-MM-DD, DD.MM.YYYY and DD/MM/YYYY. */
export function parseDay(s: string): string | null {
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  const eu = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  const [y, m, d] = iso ? [iso[1], iso[2], iso[3]] : eu ? [eu[3], eu[2], eu[1]] : []
  if (!y) return null
  const day = `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`
  return isDay(day) ? day : null
}

/**
 * Reads an earnings report: a header row naming the columns (model, platforma, data, suma, optional minute)
 * then one row per model, platform and day. Line numbers in errors are 1-based as in a spreadsheet.
 */
export function parseEarningsCsv(text: string): { rows: EarningRow[]; errors: RowError[] } {
  const table = parseCsv(text)
  if (table.length < 2) return { rows: [], errors: [{ line: 1, message: 'Fișierul nu are rânduri de date.' }] }
  const cols = table[0]!.map((h) => HEADERS[norm(h)])
  const idx = (k: string) => cols.indexOf(k as never)
  const missing = ['model', 'platform', 'day', 'amount'].filter((k) => idx(k) < 0)
  if (missing.length) {
    return { rows: [], errors: [{ line: 1, message: `Lipsesc coloanele: ${missing.join(', ')}. Antet așteptat: model, platforma, data, suma, minute (opțional).` }] }
  }
  const rows: EarningRow[] = []
  const errors: RowError[] = []
  table.slice(1).forEach((r, i) => {
    const line = i + 2
    const model = r[idx('model')] ?? ''
    const platform = r[idx('platform')] ?? ''
    const day = parseDay(r[idx('day')] ?? '')
    const amountCents = parseAmount(r[idx('amount')] ?? '')
    const minutesRaw = idx('minutes') >= 0 ? (r[idx('minutes')] ?? '') : ''
    const minutes = minutesRaw === '' ? null : /^\d+$/.test(minutesRaw) ? Number(minutesRaw) : NaN
    if (!model) return errors.push({ line, message: 'Lipsește modelul.' })
    if (!platform) return errors.push({ line, message: 'Lipsește platforma.' })
    if (!day) return errors.push({ line, message: `Dată invalidă: „${r[idx('day')] ?? ''}”.` })
    if (amountCents === null) return errors.push({ line, message: `Sumă invalidă: „${r[idx('amount')] ?? ''}”.` })
    if (Number.isNaN(minutes)) return errors.push({ line, message: `Minute invalide: „${minutesRaw}”.` })
    rows.push({ line, model, platform, day, amountCents, minutes })
  })
  return { rows, errors }
}
