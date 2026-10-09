/**
 * Pricing engine — pure & deterministic. The server always recomputes prices
 * from the catalogue; nothing price-related is trusted from the client.
 *
 * B2C prices are VAT-inclusive (Romanian consumer law). VAT is extracted per
 * component according to its VAT class (frames and lenses can differ).
 */
import type { LineConfiguration, PriceLine } from './db/schema'

export type VatClassName = 'standard' | 'reduced' | 'exempt'
export type VatRates = { standard: number; reduced: number; exempt: number }

export type CatalogLensType = {
  code: string
  name: string
  summary: string
  price: number
  requiresPrescription: boolean
  requiresAdd: boolean
  minFittingHeight: number | null
  categories: ('optical' | 'sun')[]
  vatClass: VatClassName
  active: boolean
}
export type CatalogLensIndex = {
  code: string
  name: string
  summary: string
  price: number
  refractiveIndex: number
  recommendedUpTo: number | null
  lensTypes: string[]
  active: boolean
}
export type CatalogTreatment = {
  code: string
  name: string
  summary: string
  price: number
  isDefault: boolean
  exclusiveGroup: string | null
  categories: ('optical' | 'sun')[]
  lensTypes: string[]
  active: boolean
}
export type LensCatalog = { types: CatalogLensType[]; indices: CatalogLensIndex[]; treatments: CatalogTreatment[] }

export type FrameForPricing = {
  name: string
  variantName: string
  price: number
  category: 'optical' | 'sun'
  lensHeight: number
  rim: 'full' | 'semi' | 'rimless'
  vatClass: VatClassName
}

export type PricedLine = {
  ok: boolean
  errors: string[]
  lines: PriceLine[]
  unitPrice: number
  framePrice: number
  lensPrice: number
  vat: number
}

export const vatPortion = (gross: number, rate: number) => (rate <= 0 ? 0 : Math.round(gross - gross / (1 + rate / 100)))

export function lensTypeLabel(code: string, category: 'optical' | 'sun', fallback: string) {
  if (code === 'none') return category === 'sun' ? 'Lentile originale, fără dioptrii' : 'Doar rama, fără lentile'
  return fallback
}

/** Treatments that can be offered for a given frame category & lens type. */
export function availableTreatments(catalog: LensCatalog, category: 'optical' | 'sun', lensType: string) {
  return catalog.treatments.filter((t) => t.active && t.categories.includes(category) && t.lensTypes.includes(lensType))
}
export function availableIndices(catalog: LensCatalog, lensType: string) {
  return catalog.indices.filter((i) => i.active && i.lensTypes.includes(lensType))
}
export function availableLensTypes(catalog: LensCatalog, category: 'optical' | 'sun') {
  return catalog.types.filter((t) => t.active && t.categories.includes(category))
}

/** Normalise a configuration: drop unavailable options, add defaults, enforce exclusivity. */
export function normalizeConfiguration(frame: FrameForPricing, config: LineConfiguration, catalog: LensCatalog): LineConfiguration {
  const type = catalog.types.find((t) => t.code === config.lensType && t.active) ?? catalog.types.find((t) => t.code === 'none')
  const lensType = type?.code ?? 'none'
  if (lensType === 'none') return { lensType, treatments: [], rxMode: undefined }
  const indices = availableIndices(catalog, lensType)
  const lensIndex = indices.find((i) => i.code === config.lensIndex)?.code ?? indices[0]?.code
  const allowed = availableTreatments(catalog, frame.category, lensType)
  const chosen = new Set(config.treatments.filter((c) => allowed.some((t) => t.code === c)))
  for (const t of allowed) if (t.isDefault && t.price === 0) chosen.add(t.code)
  // enforce exclusive groups (keep the last one listed in the original order)
  const seen = new Map<string, string>()
  for (const code of config.treatments) {
    const t = allowed.find((x) => x.code === code)
    if (t?.exclusiveGroup && chosen.has(code)) {
      const prev = seen.get(t.exclusiveGroup)
      if (prev) chosen.delete(prev)
      seen.set(t.exclusiveGroup, code)
    }
  }
  return { ...config, lensType, lensIndex, treatments: allowed.filter((t) => chosen.has(t.code)).map((t) => t.code) }
}

export function priceConfiguration(frame: FrameForPricing, rawConfig: LineConfiguration, catalog: LensCatalog, vat: VatRates): PricedLine {
  const errors: string[] = []
  const lines: PriceLine[] = []
  const config = normalizeConfiguration(frame, rawConfig, catalog)

  lines.push({ code: 'frame', label: `Rama ${frame.name} · ${frame.variantName}`, amount: frame.price })
  const frameVat = vatPortion(frame.price, vat[frame.vatClass])

  const type = catalog.types.find((t) => t.code === config.lensType)
  let lensPrice = 0
  let lensVatRate = vat.standard
  if (type && type.code !== 'none') {
    lensVatRate = vat[type.vatClass]
    if (!type.categories.includes(frame.category)) errors.push(`${type.name} nu sunt disponibile pentru acest tip de ramă.`)
    if (type.minFittingHeight && frame.lensHeight < type.minFittingHeight) {
      errors.push(`${type.name} au nevoie de o ramă cu înălțimea lentilei de minimum ${type.minFittingHeight} mm (rama are ${frame.lensHeight} mm).`)
    }
    lines.push({ code: `type:${type.code}`, label: `Lentile ${type.name.toLowerCase()}`, amount: type.price })
    lensPrice += type.price

    const idx = catalog.indices.find((i) => i.code === config.lensIndex)
    if (idx) {
      lines.push({ code: `index:${idx.code}`, label: `Indice ${idx.code} · ${idx.name}`, amount: idx.price })
      lensPrice += idx.price
    } else {
      errors.push('Alege grosimea lentilelor (indicele).')
    }
    for (const code of config.treatments) {
      const t = catalog.treatments.find((x) => x.code === code)
      if (!t) continue
      lines.push({ code: `treatment:${t.code}`, label: t.name, amount: t.price })
      lensPrice += t.price
    }
    if (type.requiresPrescription && !config.rxMode) errors.push('Spune-ne cum ne trimiți rețeta.')
  } else if (type) {
    lines.push({ code: 'type:none', label: lensTypeLabel('none', frame.category, type.name), amount: 0 })
  }

  const unitPrice = frame.price + lensPrice
  return {
    ok: errors.length === 0,
    errors,
    lines,
    unitPrice,
    framePrice: frame.price,
    lensPrice,
    vat: frameVat + vatPortion(lensPrice, lensVatRate),
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   Cart totals, coupons, shipping
   ────────────────────────────────────────────────────────────────────────── */

export type CouponLike = {
  code: string
  kind: string // percent | fixed | free_shipping
  value: number
  minSubtotal: number
  appliesTo: string // all | frames | lenses
  active: boolean
  startsAt: Date | null
  endsAt: Date | null
  usageLimit: number | null
  usedCount: number
}

export type ShippingChoice = 'courier' | 'easybox' | 'pickup'

export type TotalsInput = {
  lines: { unitPrice: number; quantity: number; framePrice: number; lensPrice: number; vat: number }[]
  coupon?: CouponLike | null
  shippingMethod?: ShippingChoice
  paymentMethod?: 'card' | 'cod' | 'transfer' | 'store'
  shipping: {
    freeThreshold: number
    courier: { price: number; enabled: boolean }
    easybox: { price: number; enabled: boolean }
    pickup: { price: number; enabled: boolean }
    codFee: number
  }
  vatStandard: number
  now?: Date
}

export type Totals = {
  subtotal: number
  discount: number
  shipping: number
  codFee: number
  vat: number
  total: number
  freeShippingRemaining: number
  couponError?: string
  couponApplied?: string
}

export function couponProblem(c: CouponLike, subtotal: number, now = new Date()): string | null {
  if (!c.active) return 'Codul nu mai este activ.'
  if (c.startsAt && c.startsAt > now) return 'Codul nu este încă valabil.'
  if (c.endsAt && c.endsAt < now) return 'Codul a expirat.'
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return 'Codul a atins numărul maxim de utilizări.'
  if (subtotal < c.minSubtotal) return `Codul se aplică la comenzi de minimum ${Math.round(c.minSubtotal / 100)} lei.`
  return null
}

export function computeTotals(input: TotalsInput): Totals {
  const subtotal = input.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
  const frames = input.lines.reduce((s, l) => s + l.framePrice * l.quantity, 0)
  const lenses = input.lines.reduce((s, l) => s + l.lensPrice * l.quantity, 0)
  const lineVat = input.lines.reduce((s, l) => s + l.vat * l.quantity, 0)

  let discount = 0
  let freeShippingByCoupon = false
  let couponError: string | undefined
  let couponApplied: string | undefined
  if (input.coupon) {
    const problem = couponProblem(input.coupon, subtotal, input.now)
    if (problem) couponError = problem
    else {
      couponApplied = input.coupon.code
      const base = input.coupon.appliesTo === 'frames' ? frames : input.coupon.appliesTo === 'lenses' ? lenses : subtotal
      if (input.coupon.kind === 'percent') discount = Math.round((base * Math.min(100, input.coupon.value)) / 100)
      else if (input.coupon.kind === 'fixed') discount = Math.min(base, input.coupon.value)
      else if (input.coupon.kind === 'free_shipping') freeShippingByCoupon = true
    }
  }

  const afterDiscount = subtotal - discount
  const method = input.shippingMethod ?? 'courier'
  const cfg = input.shipping[method]
  const qualifiesFree = afterDiscount >= input.shipping.freeThreshold || freeShippingByCoupon
  const shipping = subtotal === 0 || method === 'pickup' || qualifiesFree ? 0 : cfg.price
  const codFee = input.paymentMethod === 'cod' && subtotal > 0 ? input.shipping.codFee : 0

  const discountRatio = subtotal > 0 ? afterDiscount / subtotal : 1
  const vat = Math.round(lineVat * discountRatio) + vatPortion(shipping + codFee, input.vatStandard)
  return {
    subtotal,
    discount,
    shipping,
    codFee,
    vat,
    total: afterDiscount + shipping + codFee,
    freeShippingRemaining: Math.max(0, input.shipping.freeThreshold - afterDiscount),
    couponError,
    couponApplied,
  }
}

/** B2B: wholesale (VAT-exclusive) price after partner discount. */
export function partnerPrice(wholesale: number, discountPercent: number) {
  return Math.round(wholesale * (1 - Math.max(0, Math.min(90, discountPercent)) / 100))
}
