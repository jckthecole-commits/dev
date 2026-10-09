/**
 * In-memory catalogue filtering & faceting. The active catalogue for a
 * category is small (hundreds of SKUs) and cached, so filtering in JS gives
 * instant, exact facet counts without a search cluster. Pure → unit-tested.
 */
import type { FrameGeometry, Swatch } from './db/schema'
import { FITS, PAGE_SIZE, type CatalogFilters } from './catalog-filters'
import { normalizeSearch } from './text'

export type CardVariant = {
  id: string
  sku: string
  colorName: string
  colorSlug: string
  colorFamily: string
  swatch: Swatch
  priceDelta: number
  isDefault: boolean
  available: number
}

export type ProductCard = {
  id: string
  slug: string
  name: string
  family: string
  modelCode: string
  category: 'optical' | 'sun'
  audience: string
  shape: string
  material: string
  rim: 'full' | 'semi' | 'rimless'
  lensWidth: number
  bridgeWidth: number
  templeLength: number
  lensHeight: number
  frameWidth: number
  weightGrams: number | null
  geometry: FrameGeometry
  price: number
  compareAtPrice: number | null
  badge: string | null
  tagline: string | null
  features: string[]
  polarized: boolean
  filterCategory: number | null
  featured: boolean
  position: number
  publishedAt: string | null
  searchText: string
  image: { key: string; alt: string; width: number | null; height: number | null } | null
  variants: CardVariant[]
}

export type Facet = { value: string; count: number }
export type Facets = Record<'shape' | 'material' | 'rim' | 'audience' | 'fit' | 'color' | 'feature', Facet[]>

export function fitOf(frameWidth: number) {
  return FITS.find((f) => frameWidth >= f.min && frameWidth <= f.max)?.value ?? 'm'
}

export function featuresOf(p: ProductCard): string[] {
  const out: string[] = []
  if (p.category === 'optical' && p.lensHeight >= 28) out.push('progresive')
  if ((p.weightGrams ?? 99) < 20) out.push('usoara')
  if (p.features.includes('flex')) out.push('flex')
  if (p.features.includes('plachete')) out.push('plachete')
  if (p.polarized) out.push('polarizat')
  return out
}

type Predicate = (p: ProductCard) => boolean

function predicates(f: CatalogFilters): Record<keyof Facets | 'other', Predicate> {
  const tokens = normalizeSearch(f.q).split(' ').filter(Boolean)
  const inRange = (v: number, min: number | null, max: number | null) => (min === null || v >= min) && (max === null || v <= max)
  return {
    shape: (p) => !f.shape.length || f.shape.includes(p.shape as never),
    material: (p) => !f.material.length || f.material.includes(p.material as never),
    rim: (p) => !f.rim.length || f.rim.includes(p.rim),
    audience: (p) => !f.audience.length || f.audience.includes(p.audience) || (p.audience === 'unisex' && f.audience.some((a) => a === 'women' || a === 'men')),
    fit: (p) => !f.fit.length || f.fit.includes(fitOf(p.frameWidth)),
    color: (p) => !f.color.length || p.variants.some((v) => f.color.includes(v.colorFamily)),
    feature: (p) => {
      if (!f.feature.length) return true
      const have = featuresOf(p)
      return f.feature.every((x) => have.includes(x))
    },
    other: (p) =>
      inRange(p.price / 100, f.priceMin, f.priceMax) &&
      inRange(p.lensWidth, f.lensMin, f.lensMax) &&
      inRange(p.bridgeWidth, f.bridgeMin, f.bridgeMax) &&
      inRange(p.templeLength, f.templeMin, f.templeMax) &&
      tokens.every((t) => p.searchText.includes(t)),
  }
}

export function queryCatalog(all: ProductCard[], f: CatalogFilters) {
  const preds = predicates(f)
  const keys = Object.keys(preds) as (keyof typeof preds)[]
  const matchAll = (p: ProductCard, except?: string) => keys.every((k) => k === except || preds[k](p))

  const results = all.filter((p) => matchAll(p))

  const count = (except: keyof Facets, valuesOf: (p: ProductCard) => string[]): Facet[] => {
    const m = new Map<string, number>()
    for (const p of all) {
      if (!matchAll(p, except)) continue
      for (const v of new Set(valuesOf(p))) m.set(v, (m.get(v) ?? 0) + 1)
    }
    return [...m.entries()].map(([value, c]) => ({ value, count: c }))
  }
  const facets: Facets = {
    shape: count('shape', (p) => [p.shape]),
    material: count('material', (p) => [p.material]),
    rim: count('rim', (p) => [p.rim]),
    audience: count('audience', (p) => [p.audience]),
    fit: count('fit', (p) => [fitOf(p.frameWidth)]),
    color: count('color', (p) => p.variants.map((v) => v.colorFamily)),
    feature: count('feature', featuresOf),
  }

  const sorted = [...results].sort((a, b) => {
    switch (f.sort) {
      case 'pret-asc':
        return a.price - b.price
      case 'pret-desc':
        return b.price - a.price
      case 'noi':
        return (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')
      case 'latime':
        return a.frameWidth - b.frameWidth
      default:
        return Number(b.featured) - Number(a.featured) || a.position - b.position
    }
  })

  const total = sorted.length
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(f.page, pages)
  const items = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const prices = all.map((p) => p.price / 100)
  return {
    items,
    total,
    page,
    pages,
    facets,
    bounds: { priceMin: Math.floor(Math.min(...prices, 0)), priceMax: Math.ceil(Math.max(...prices, 0)) },
  }
}

/** Variant to show first on a card: matches the colour filter when one is active. */
export function preferredVariant(p: ProductCard, colorFilter: string[] = []) {
  return (colorFilter.length ? p.variants.find((v) => colorFilter.includes(v.colorFamily)) : undefined) ?? p.variants.find((v) => v.isDefault) ?? p.variants[0]
}
