import { describe, expect, it } from 'vitest'
import { parseCsv, parseDay, parseEarningsCsv } from '@/lib/csv'

describe('parseCsv', () => {
  it('handles quotes, escaped quotes and CRLF', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"']])
  })
  it('detects semicolons and tabs', () => {
    expect(parseCsv('a;b\n1,5;2')).toEqual([['a', 'b'], ['1,5', '2']])
    expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']])
  })
  it('skips blank lines and a BOM', () => {
    expect(parseCsv('﻿a,b\n\n1,2\n')).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('parseDay', () => {
  it('reads ISO and European dates', () => {
    expect(parseDay('2026-11-05')).toBe('2026-11-05')
    expect(parseDay('5.11.2026')).toBe('2026-11-05')
    expect(parseDay('05/11/2026')).toBe('2026-11-05')
  })
  it('rejects impossible dates', () => {
    expect(parseDay('2026-02-30')).toBeNull()
    expect(parseDay('31.04.2026')).toBeNull()
  })
})

describe('parseEarningsCsv', () => {
  it('maps Romanian headers with diacritics and optional minutes', () => {
    const { rows, errors } = parseEarningsCsv('Model;Platformă;Dată;Sumă;Minute\nLuna;Platforma A;14.11.2026;1.240,50;300\nAria;Platforma B;2026-11-14;80;')
    expect(errors).toEqual([])
    expect(rows).toEqual([
      { line: 2, model: 'Luna', platform: 'Platforma A', day: '2026-11-14', amountCents: 124050, minutes: 300 },
      { line: 3, model: 'Aria', platform: 'Platforma B', day: '2026-11-14', amountCents: 8000, minutes: null },
    ])
  })
  it('reports missing columns', () => {
    expect(parseEarningsCsv('model,suma\nLuna,5').errors[0]!.message).toMatch(/platform/)
  })
  it('reports bad rows with spreadsheet line numbers', () => {
    const { rows, errors } = parseEarningsCsv('model,platforma,data,suma\nLuna,A,2026-13-01,5\nLuna,A,2026-11-01,abc\n,A,2026-11-01,5\nLuna,A,2026-11-01,5')
    expect(rows).toHaveLength(1)
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4])
  })
})
