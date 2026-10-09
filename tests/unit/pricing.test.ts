import { describe, expect, it } from 'vitest'
import { computeTotals, couponProblem, normalizeConfiguration, partnerPrice, priceConfiguration, vatPortion, type CouponLike, type FrameForPricing, type LensCatalog, type TotalsInput } from '@/lib/pricing'

const catalog: LensCatalog = {
  types: [
    { code: 'none', name: 'Fără lentile', summary: '', price: 0, requiresPrescription: false, requiresAdd: false, minFittingHeight: null, categories: ['optical', 'sun'], vatClass: 'standard', active: true },
    { code: 'single', name: 'Monofocale', summary: '', price: 14900, requiresPrescription: true, requiresAdd: false, minFittingHeight: null, categories: ['optical', 'sun'], vatClass: 'standard', active: true },
    { code: 'progressive', name: 'Progresive', summary: '', price: 69000, requiresPrescription: true, requiresAdd: true, minFittingHeight: 28, categories: ['optical'], vatClass: 'standard', active: true },
  ],
  indices: [
    { code: '1.50', name: 'Standard', summary: '', price: 0, refractiveIndex: 1.5, recommendedUpTo: 2, lensTypes: ['single', 'progressive'], active: true },
    { code: '1.67', name: 'Extra-subțiat', summary: '', price: 26000, refractiveIndex: 1.67, recommendedUpTo: 6, lensTypes: ['single', 'progressive'], active: true },
  ],
  treatments: [
    { code: 'hardcoat', name: 'Durificare', summary: '', price: 0, isDefault: true, exclusiveGroup: null, categories: ['optical', 'sun'], lensTypes: ['single', 'progressive'], active: true },
    { code: 'blue', name: 'Filtru albastru', summary: '', price: 12900, isDefault: false, exclusiveGroup: null, categories: ['optical'], lensTypes: ['single', 'progressive'], active: true },
    { code: 'photo', name: 'Fotocromatic', summary: '', price: 29000, isDefault: false, exclusiveGroup: 'tint', categories: ['optical'], lensTypes: ['single', 'progressive'], active: true },
    { code: 'polar', name: 'Polarizat', summary: '', price: 19000, isDefault: false, exclusiveGroup: 'tint', categories: ['optical', 'sun'], lensTypes: ['single'], active: true },
  ],
}
const frame: FrameForPricing = { name: 'Mira 52', variantName: 'Negru', price: 28900, category: 'optical', lensHeight: 38, rim: 'full', vatClass: 'standard' }
const VAT = { standard: 21, reduced: 11, exempt: 0 }

describe('configuration', () => {
  it('adds included treatments and resolves exclusive groups (last choice wins)', () => {
    const c = normalizeConfiguration(frame, { lensType: 'single', treatments: ['photo', 'polar', 'blue'], rxMode: 'manual' }, catalog)
    expect(c.lensIndex).toBe('1.50')
    expect(c.treatments).toEqual(['hardcoat', 'blue', 'polar'])
  })
  it('drops everything when no lenses are chosen', () => {
    expect(normalizeConfiguration(frame, { lensType: 'none', treatments: ['blue'] }, catalog).treatments).toEqual([])
  })
  it('prices frame + lenses + index + treatments', () => {
    const p = priceConfiguration(frame, { lensType: 'single', lensIndex: '1.67', treatments: ['blue'], rxMode: 'manual' }, catalog, VAT)
    expect(p.ok).toBe(true)
    expect(p.unitPrice).toBe(28900 + 14900 + 26000 + 12900)
    expect(p.lines.map((l) => l.code)).toEqual(['frame', 'type:single', 'index:1.67', 'treatment:hardcoat', 'treatment:blue'])
    expect(p.vat).toBe(vatPortion(28900, 21) + vatPortion(14900 + 26000 + 12900, 21))
  })
  it('refuses progressives in a frame that is too shallow', () => {
    const p = priceConfiguration({ ...frame, lensHeight: 26 }, { lensType: 'progressive', treatments: [], rxMode: 'manual' }, catalog, VAT)
    expect(p.ok).toBe(false)
    expect(p.errors.join(' ')).toContain('28 mm')
  })
  it('requires a way to send the prescription', () => {
    expect(priceConfiguration(frame, { lensType: 'single', treatments: [] }, catalog, VAT).ok).toBe(false)
  })
})

describe('totals', () => {
  const shipping: TotalsInput['shipping'] = { freeThreshold: 30000, courier: { price: 1999, enabled: true }, easybox: { price: 1499, enabled: true }, pickup: { price: 0, enabled: true }, codFee: 0 }
  const line = (unit: number, lens = 0) => ({ unitPrice: unit, quantity: 1, framePrice: unit - lens, lensPrice: lens, vat: vatPortion(unit, 21) })
  const coupon = (c: Partial<CouponLike>): CouponLike => ({ code: 'X', kind: 'percent', value: 10, minSubtotal: 0, appliesTo: 'all', active: true, startsAt: null, endsAt: null, usageLimit: null, usedCount: 0, ...c })

  it('charges shipping below the threshold and not above', () => {
    expect(computeTotals({ lines: [line(25000)], shipping, vatStandard: 21 }).shipping).toBe(1999)
    expect(computeTotals({ lines: [line(31000)], shipping, vatStandard: 21 }).shipping).toBe(0)
    expect(computeTotals({ lines: [line(25000)], shipping, shippingMethod: 'pickup', vatStandard: 21 }).shipping).toBe(0)
  })
  it('applies percent coupons to the right base', () => {
    const t = computeTotals({ lines: [line(50000, 20000)], coupon: coupon({ appliesTo: 'lenses', value: 50 }), shipping, vatStandard: 21 })
    expect(t.discount).toBe(10000)
    expect(t.total).toBe(40000)
  })
  it('free shipping coupon and fixed coupons never exceed the base', () => {
    expect(computeTotals({ lines: [line(10000)], coupon: coupon({ kind: 'free_shipping' }), shipping, vatStandard: 21 }).shipping).toBe(0)
    expect(computeTotals({ lines: [line(10000, 2000)], coupon: coupon({ kind: 'fixed', value: 5000, appliesTo: 'lenses' }), shipping, vatStandard: 21 }).discount).toBe(2000)
  })
  it('discount can drop the order below the free-shipping threshold', () => {
    const t = computeTotals({ lines: [line(32000)], coupon: coupon({ value: 10 }), shipping, vatStandard: 21 })
    expect(t.shipping).toBe(1999)
    expect(t.freeShippingRemaining).toBe(30000 - 28800)
  })
  it('validates coupons', () => {
    const now = new Date('2026-10-09T10:00:00Z')
    expect(couponProblem(coupon({ active: false }), 1000, now)).toMatch(/activ/)
    expect(couponProblem(coupon({ endsAt: new Date('2026-10-01T00:00:00Z') }), 1000, now)).toMatch(/expirat/)
    expect(couponProblem(coupon({ usageLimit: 5, usedCount: 5 }), 1000, now)).toMatch(/maxim/)
    expect(couponProblem(coupon({ minSubtotal: 20000 }), 1000, now)).toMatch(/200 lei/)
    expect(couponProblem(coupon({}), 1000, now)).toBeNull()
  })
  it('VAT follows the discount proportionally and includes shipping', () => {
    const t = computeTotals({ lines: [line(20000)], coupon: coupon({ value: 50 }), shipping, vatStandard: 21 })
    expect(t.vat).toBe(Math.round(vatPortion(20000, 21) * 0.5) + vatPortion(1999, 21))
  })
})

describe('B2B', () => {
  it('applies the partner discount with sane bounds', () => {
    expect(partnerPrice(10000, 10)).toBe(9000)
    expect(partnerPrice(10000, -5)).toBe(10000)
    expect(partnerPrice(10000, 200)).toBe(1000)
  })
})
