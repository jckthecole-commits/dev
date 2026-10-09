import { describe, expect, it } from 'vitest'
import { hoursFor, icsEvent, slotsForDay, type Busy } from '@/lib/booking'
import type { DayHours } from '@/lib/settings-schema'
import { addDays, weekdayOf, zonedDay, zonedTime, zonedToUtc } from '@/lib/time'

const weekly: DayHours[] = [...[1, 2, 3, 4, 5].map((day): DayHours => ({ day, open: '10:00', close: '13:00' })), { day: 6, open: '10:00', close: '12:00' }, { day: 0, closed: true }]
const consult = { code: 'consult', durationMin: 30, capacity: 1 }
const fitting = { code: 'fitting', durationMin: 20, capacity: 2 }
const MON = '2026-10-12'
const before = new Date('2026-10-01T00:00:00Z')

describe('Bucharest time', () => {
  it('handles both sides of the DST change', () => {
    expect(zonedToUtc('2026-07-01', '10:00').toISOString()).toBe('2026-07-01T07:00:00.000Z')
    expect(zonedToUtc('2026-12-01', '10:00').toISOString()).toBe('2026-12-01T08:00:00.000Z')
    expect(zonedToUtc('2026-10-25', '12:00').toISOString()).toBe('2026-10-25T10:00:00.000Z')
  })
  it('round-trips day and time', () => {
    const d = zonedToUtc(MON, '10:30')
    expect(zonedDay(d)).toBe(MON)
    expect(zonedTime(d)).toBe('10:30')
    expect(zonedDay(new Date('2026-10-11T22:30:00Z'))).toBe(MON)
  })
  it('does calendar arithmetic', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(weekdayOf(MON)).toBe(1)
  })
})

describe('opening hours', () => {
  it('uses exceptions before the weekly schedule', () => {
    expect(hoursFor(MON, weekly, [])).toEqual({ open: '10:00', close: '13:00' })
    expect(hoursFor('2026-10-18', weekly, [])).toBeNull()
    expect(hoursFor(MON, weekly, [{ day: MON, closed: true, opens: null, closes: null }])).toBeNull()
    expect(hoursFor(MON, weekly, [{ day: MON, closed: false, opens: '11:00', closes: '12:00' }])).toEqual({ open: '11:00', close: '12:00' })
  })
})

describe('slotsForDay', () => {
  const base = { day: MON, weekly, exceptions: [], step: 30, now: before, leadMinutes: 120 }
  it('fits the whole appointment before closing', () => {
    expect(slotsForDay({ ...base, service: consult, busy: [] })).toEqual(['10:00', '10:30', '11:00', '11:30', '12:00', '12:30'])
  })
  it('respects capacity and the single optometrist', () => {
    const busy: Busy[] = [{ startsAt: zonedToUtc(MON, '10:00'), endsAt: zonedToUtc(MON, '10:30'), serviceCode: 'consult' }]
    expect(slotsForDay({ ...base, service: consult, busy, exclusiveCodes: ['consult', 'contact'] })).not.toContain('10:00')
    const two: Busy[] = [0, 1].map(() => ({ startsAt: zonedToUtc(MON, '11:00'), endsAt: zonedToUtc(MON, '11:20'), serviceCode: 'fitting' }))
    expect(slotsForDay({ ...base, service: fitting, busy: two })).not.toContain('11:00')
    expect(slotsForDay({ ...base, service: fitting, busy: two.slice(1) })).toContain('11:00')
  })
  it('keeps a lead time from now', () => {
    const now = zonedToUtc(MON, '10:10')
    expect(slotsForDay({ ...base, now, service: consult, busy: [] })[0]).toBe('12:30')
  })
  it('returns nothing on closed days', () => {
    expect(slotsForDay({ ...base, day: '2026-10-18', service: consult, busy: [] })).toEqual([])
  })
})

describe('icsEvent', () => {
  it('produces a valid VEVENT with CRLF line endings', () => {
    const ics = icsEvent({ uid: 'abc', start: zonedToUtc(MON, '10:00'), end: zonedToUtc(MON, '10:30'), title: 'Consultație', description: 'Test, cu virgulă; și punct-virgulă', location: 'Galați' })
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('DTSTART:20261012T070000Z')
    expect(ics).toContain('\r\n')
    expect(ics).toContain(String.raw`Test\, cu virgulă\; și punct-virgulă`)
  })
})
