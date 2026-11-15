import { describe, expect, it } from 'vitest'
import { addMonths, isDay, monthDays, monthRange, today, weekStart } from '@/lib/dates'

describe('dates', () => {
  it('finds Monday', () => {
    expect(weekStart('2026-11-15')).toBe('2026-11-09') // Sunday
    expect(weekStart('2026-11-16')).toBe('2026-11-16')
  })
  it('knows month lengths', () => {
    expect(monthRange('2028-02')).toEqual({ first: '2028-02-01', last: '2028-02-29' })
    expect(monthDays('2026-11')).toHaveLength(30)
  })
  it('crosses years', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
  })
  it('uses the Bucharest calendar day', () => {
    expect(today(new Date('2026-11-15T22:30:00Z'))).toBe('2026-11-16')
  })
  it('validates days', () => {
    expect(isDay('2026-11-31')).toBe(false)
    expect(isDay('2026-11-30')).toBe(true)
  })
})
