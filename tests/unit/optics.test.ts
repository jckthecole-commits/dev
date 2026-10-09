import { describe, expect, it } from 'vitest'
import { dominantPower, emptyRx, type RxValues, estimateThickness, formatDiopter, parseAxis, parseDiopter, parsePd, recommendIndex, sphericalEquivalent, toMinusCyl, validateRx } from '@/lib/optics'

describe('parsing', () => {
  it('reads Romanian and typographic diopters', () => {
    expect(parseDiopter('−1,25')).toBe(-1.25)
    expect(parseDiopter('+0.5')).toBe(0.5)
    expect(parseDiopter('-2')).toBe(-2)
    expect(parseDiopter('plan')).toBe(0)
    expect(parseDiopter('')).toBeNull()
    expect(parseDiopter('abc')).toBeNull()
    expect(parseDiopter('-')).toBeNull()
  })
  it('reads axis and PD', () => {
    expect(parseAxis('90°')).toBe(90)
    expect(parseAxis('12.5')).toBeNull()
    expect(parsePd('63,5 mm')).toBe(63.5)
  })
  it('formats like a prescription', () => {
    expect(formatDiopter(-1.25)).toBe('−1,25')
    expect(formatDiopter(2)).toBe('+2,00')
    expect(formatDiopter(0)).toBe('0,00')
    expect(formatDiopter(0, { plano: true })).toBe('plan')
    expect(formatDiopter(null)).toBe('—')
  })
})

describe('notation & equivalents', () => {
  it('transposes plus cylinder to minus cylinder', () => {
    expect(toMinusCyl({ sph: -2, cyl: 1, axis: 30, add: null })).toEqual({ sph: -1, cyl: -1, axis: 120, add: null })
    expect(toMinusCyl({ sph: 1, cyl: 0.5, axis: 150, add: null })).toEqual({ sph: 1.5, cyl: -0.5, axis: 60, add: null })
  })
  it('computes spherical equivalent and dominant power', () => {
    expect(sphericalEquivalent({ sph: -2, cyl: -1 })).toBe(-2.5)
    expect(dominantPower({ od: { sph: -2, cyl: -1.5, axis: 90, add: null }, os: { sph: 1, cyl: 0, axis: null, add: null } })).toBe(-3.5)
  })
})

describe('validateRx', () => {
  const rx = (): RxValues => ({ ...emptyRx(), od: { sph: -1.25, cyl: -0.5, axis: 180, add: null }, os: { sph: -1, cyl: 0, axis: null, add: null } })
  it('accepts a normal prescription', () => {
    expect(validateRx(rx()).filter((i) => i.level === 'error')).toEqual([])
  })
  it('requires an axis when there is cylinder', () => {
    const r = rx()
    r.od.axis = null
    expect(validateRx(r).some((i) => i.field === 'od.axis' && i.level === 'error')).toBe(true)
  })
  it('rejects values off the 0.25 grid and out of range', () => {
    const r = rx()
    r.od.sph = -1.3
    r.os.sph = -25
    const fields = validateRx(r).filter((i) => i.level === 'error').map((i) => i.field)
    expect(fields).toContain('od.sph')
    expect(fields).toContain('os.sph')
  })
  it('requires ADD for progressives', () => {
    expect(validateRx(rx(), { requiresAdd: true }).filter((i) => i.field.endsWith('.add'))).toHaveLength(2)
  })
  it('checks PD ranges (single and dual)', () => {
    expect(validateRx({ ...rx(), pd: { mode: 'single', value: 90 } }).some((i) => i.field === 'pd')).toBe(true)
    expect(validateRx({ ...rx(), pd: { mode: 'dual', right: 31.5, left: 45 } }).some((i) => i.field === 'pd.left')).toBe(true)
    expect(validateRx({ ...rx(), pd: { mode: 'unknown' } }).find((i) => i.field === 'pd')?.level).toBe('warning')
  })
  it('warns about anisometropia', () => {
    const r = rx()
    r.os.sph = -4.5
    expect(validateRx(r).some((i) => i.message.includes('anizometropie'))).toBe(true)
  })
})

describe('recommendIndex', () => {
  const eye = (sph: number) => ({ sph, cyl: 0, axis: null, add: null })
  it('steps up with power', () => {
    expect(recommendIndex({ od: eye(-1), os: eye(-1) }, { rim: 'full' })).toBe('1.50')
    expect(recommendIndex({ od: eye(-3), os: eye(-2) }, { rim: 'full' })).toBe('1.60')
    expect(recommendIndex({ od: eye(-5.5), os: eye(-5) }, { rim: 'full' })).toBe('1.67')
    expect(recommendIndex({ od: eye(-8), os: eye(-7) }, { rim: 'full' })).toBe('1.74')
  })
  it('never puts CR-39 in drilled or nylor frames', () => {
    expect(recommendIndex({ od: eye(-0.5), os: eye(-0.5) }, { rim: 'rimless' })).toBe('1.60')
  })
  it('caps progressives at 1.67', () => {
    expect(recommendIndex({ od: eye(-9), os: eye(-9) }, { rim: 'full' }, 'progressive')).toBe('1.67')
  })
})

describe('estimateThickness', () => {
  const frame = { lensWidth: 52, bridgeWidth: 18 }
  it('minus lenses are thick at the edge and thinner with a higher index', () => {
    const a = estimateThickness(-4, '1.50', frame, 63)
    const b = estimateThickness(-4, '1.67', frame, 63)
    expect(a.kind).toBe('minus')
    expect(a.edge).toBeGreaterThan(a.center)
    expect(b.edge).toBeLessThan(a.edge)
  })
  it('plus lenses are thick in the centre', () => {
    const t = estimateThickness(3, '1.60', frame, 63)
    expect(t.kind).toBe('plus')
    expect(t.center).toBeGreaterThan(t.edge)
  })
  it('a wider frame for the same PD means a thicker edge (decentration)', () => {
    expect(estimateThickness(-4, '1.50', { lensWidth: 56, bridgeWidth: 20 }, 60).edge).toBeGreaterThan(estimateThickness(-4, '1.50', frame, 60).edge)
  })
})
