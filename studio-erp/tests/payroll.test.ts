import { describe, expect, it } from 'vitest'
import { computePayLine, computeShare, usdToBani, validateTiers } from '@/lib/payroll'

const tiers = [
  { fromCents: 0, percentBp: 5000 },
  { fromCents: 500000, percentBp: 5500 },
  { fromCents: 1000000, percentBp: 6000 },
]

describe('computeShare — whole', () => {
  const plan = { mode: 'whole' as const, tiers }
  it('uses the first tier below the first threshold', () => {
    expect(computeShare(400000, plan)).toEqual({ shareCents: 200000, percentBp: 5000 })
  })
  it('applies the reached tier to the whole amount, threshold inclusive', () => {
    expect(computeShare(500000, plan)).toEqual({ shareCents: 275000, percentBp: 5500 })
    expect(computeShare(1200000, plan)).toEqual({ shareCents: 720000, percentBp: 6000 })
  })
  it('rounds to the nearest cent once', () => {
    expect(computeShare(333, { mode: 'whole', tiers: [{ fromCents: 0, percentBp: 5000 }] }).shareCents).toBe(167)
  })
  it('pays nothing on nothing', () => {
    expect(computeShare(0, plan).shareCents).toBe(0)
  })
})

describe('computeShare — progressive', () => {
  const plan = { mode: 'progressive' as const, tiers }
  it('taxes each slice at its own rate', () => {
    // 5000×50% + 5000×55% + 2000×60% = 2500 + 2750 + 1200 = 6450 USD
    expect(computeShare(1200000, plan)).toEqual({ shareCents: 645000, percentBp: 5375 })
  })
  it('equals the whole mode inside the first tier', () => {
    expect(computeShare(300000, plan).shareCents).toBe(150000)
  })
  it('accepts unsorted tiers', () => {
    expect(computeShare(1200000, { mode: 'progressive', tiers: [...tiers].reverse() }).shareCents).toBe(645000)
  })
})

describe('computePayLine', () => {
  it('adds bonuses, subtracts advances and deductions, converts to RON', () => {
    const line = computePayLine(400000, { mode: 'whole', tiers }, { bonusCents: 10000, advanceCents: 50000, deductionCents: 5000 }, 46000)
    expect(line.netCents).toBe(200000 + 10000 - 50000 - 5000)
    expect(line.netBani).toBe(Math.round(155000 * 4.6))
  })
  it('can go negative when the advance exceeds the share', () => {
    expect(computePayLine(0, { mode: 'whole', tiers }, { bonusCents: 0, advanceCents: 10000, deductionCents: 0 }, 46000).netCents).toBe(-10000)
  })
})

describe('usdToBani', () => {
  it('converts at 4 decimal places', () => expect(usdToBani(12345, 46512)).toBe(57419))
})

describe('validateTiers', () => {
  it('accepts a valid plan', () => expect(validateTiers(tiers)).toBeNull())
  it('requires a tier from 0', () => expect(validateTiers([{ fromCents: 100, percentBp: 5000 }])).toMatch(/0/))
  it('rejects duplicates and over 100%', () => {
    expect(validateTiers([{ fromCents: 0, percentBp: 5000 }, { fromCents: 0, percentBp: 6000 }])).not.toBeNull()
    expect(validateTiers([{ fromCents: 0, percentBp: 10001 }])).not.toBeNull()
  })
  it('rejects an empty plan', () => expect(validateTiers([])).not.toBeNull())
})
