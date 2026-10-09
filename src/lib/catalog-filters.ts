/**
 * Catalogue filters ⇄ URL search params. Shared by the server (query building)
 * and the client (filter UI), so every filtered view has a shareable,
 * crawlable URL: /rame-de-vedere?forma=rotunde&material=metal&latime=m
 */
import type { Shape, Material, Rim } from './frame-geometry'

export const SHAPES: { value: Shape; label: string; plural: string; slug: string }[] = [
  { value: 'rectangular', label: 'Rectangulară', plural: 'Rectangulare', slug: 'rectangulare' },
  { value: 'square', label: 'Pătrată', plural: 'Pătrate', slug: 'patrate' },
  { value: 'round', label: 'Rotundă', plural: 'Rotunde', slug: 'rotunde' },
  { value: 'oval', label: 'Ovală', plural: 'Ovale', slug: 'ovale' },
  { value: 'cat-eye', label: 'Cat-eye', plural: 'Cat-eye', slug: 'cat-eye' },
  { value: 'pilot', label: 'Pilot', plural: 'Pilot', slug: 'pilot' },
  { value: 'browline', label: 'Browline', plural: 'Browline', slug: 'browline' },
  { value: 'geometric', label: 'Geometrică', plural: 'Geometrice', slug: 'geometrice' },
]

export const MATERIALS: { value: Material; label: string; slug: string }[] = [
  { value: 'acetat', label: 'Acetat', slug: 'acetat' },
  { value: 'metal', label: 'Metal', slug: 'metal' },
  { value: 'titan', label: 'Titan', slug: 'titan' },
  { value: 'tr90', label: 'TR90 (ultra-flexibil)', slug: 'tr90' },
  { value: 'combinat', label: 'Combinat', slug: 'combinat' },
]

export const RIMS: { value: Rim; label: string; slug: string }[] = [
  { value: 'full', label: 'Cu ramă întreagă', slug: 'intreaga' },
  { value: 'semi', label: 'Semi-rimless (cu fir de nylon)', slug: 'semi' },
  { value: 'rimless', label: 'Fără ramă (găurite)', slug: 'fara-rama' },
]

export const AUDIENCES = [
  { value: 'women', label: 'Femei', slug: 'femei' },
  { value: 'men', label: 'Bărbați', slug: 'barbati' },
  { value: 'unisex', label: 'Unisex', slug: 'unisex' },
  { value: 'kids', label: 'Copii', slug: 'copii' },
] as const

/** Fit by total frame width (mm). */
export const FITS = [
  { value: 's', label: 'Îngustă', hint: 'sub 132 mm', min: 0, max: 131 },
  { value: 'm', label: 'Medie', hint: '132–140 mm', min: 132, max: 140 },
  { value: 'l', label: 'Lată', hint: 'peste 140 mm', min: 141, max: 999 },
] as const

export const COLOR_FAMILIES = [
  { value: 'negru', label: 'Negru', hex: '#16191C' },
  { value: 'havana', label: 'Havana', hex: '#6B4226' },
  { value: 'transparent', label: 'Transparent', hex: '#DDE4E8' },
  { value: 'gri', label: 'Gri / grafit', hex: '#5C6670' },
  { value: 'albastru', label: 'Albastru', hex: '#22406E' },
  { value: 'verde', label: 'Verde', hex: '#2F5A47' },
  { value: 'rosu', label: 'Roșu / bordo', hex: '#7A1F2B' },
  { value: 'roz', label: 'Roz', hex: '#D9A0A4' },
  { value: 'maro', label: 'Maro', hex: '#5A3A22' },
  { value: 'auriu', label: 'Auriu', hex: '#C59B4E' },
  { value: 'argintiu', label: 'Argintiu', hex: '#AEB6BC' },
  { value: 'bej', label: 'Bej / miere', hex: '#C9A36A' },
] as const

export const FEATURES = [
  { value: 'progresive', label: 'Compatibilă progresive', hint: 'înălțime lentilă ≥ 28 mm' },
  { value: 'usoara', label: 'Ușoară', hint: 'sub 20 g' },
  { value: 'flex', label: 'Balamale flexibile' },
  { value: 'plachete', label: 'Plăcuțe nazale reglabile' },
  { value: 'polarizat', label: 'Polarizat' },
] as const

export const SORTS = [
  { value: 'recomandate', label: 'Recomandate' },
  { value: 'noi', label: 'Cele mai noi' },
  { value: 'pret-asc', label: 'Preț crescător' },
  { value: 'pret-desc', label: 'Preț descrescător' },
  { value: 'latime', label: 'Lățime (îngustă → lată)' },
] as const

export type SortValue = (typeof SORTS)[number]['value']

export type CatalogFilters = {
  shape: Shape[]
  material: Material[]
  rim: Rim[]
  audience: string[]
  fit: string[]
  color: string[]
  feature: string[]
  priceMin: number | null
  priceMax: number | null
  lensMin: number | null
  lensMax: number | null
  bridgeMin: number | null
  bridgeMax: number | null
  templeMin: number | null
  templeMax: number | null
  q: string
  sort: SortValue
  page: number
}

type Params = Record<string, string | string[] | undefined> | URLSearchParams

function getAll(p: Params, key: string): string[] {
  const raw = p instanceof URLSearchParams ? p.getAll(key) : ([] as string[]).concat(p[key] ?? [])
  return raw.flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean)
}
function getOne(p: Params, key: string): string | undefined {
  return getAll(p, key)[0]
}
function num(p: Params, key: string): number | null {
  const v = getOne(p, key)
  if (v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function mapSlugs<T extends { value: string; slug: string }>(list: readonly T[], slugs: string[]): T['value'][] {
  return slugs.map((s) => list.find((x) => x.slug === s || x.value === s)?.value).filter((v): v is T['value'] => !!v)
}

export function parseFilters(p: Params): CatalogFilters {
  const sort = getOne(p, 'ordonare') as SortValue | undefined
  return {
    shape: mapSlugs(SHAPES, getAll(p, 'forma')) as Shape[],
    material: mapSlugs(MATERIALS, getAll(p, 'material')) as Material[],
    rim: mapSlugs(RIMS, getAll(p, 'tip')) as Rim[],
    audience: mapSlugs(AUDIENCES, getAll(p, 'pentru')),
    fit: getAll(p, 'latime').filter((v) => FITS.some((f) => f.value === v)),
    color: getAll(p, 'culoare').filter((v) => COLOR_FAMILIES.some((c) => c.value === v)),
    feature: getAll(p, 'caracteristici').filter((v) => FEATURES.some((f) => f.value === v)),
    priceMin: num(p, 'pret-min'),
    priceMax: num(p, 'pret-max'),
    lensMin: num(p, 'lentila-min'),
    lensMax: num(p, 'lentila-max'),
    bridgeMin: num(p, 'punte-min'),
    bridgeMax: num(p, 'punte-max'),
    templeMin: num(p, 'brat-min'),
    templeMax: num(p, 'brat-max'),
    q: (getOne(p, 'q') ?? '').slice(0, 80),
    sort: SORTS.some((s) => s.value === sort) ? sort! : 'recomandate',
    page: Math.max(1, Math.min(50, num(p, 'pagina') ?? 1)),
  }
}

export function filtersToQuery(f: Partial<CatalogFilters>): string {
  const sp = new URLSearchParams()
  const slugOf = <T extends { value: string; slug: string }>(list: readonly T[], v: string) => list.find((x) => x.value === v)?.slug ?? v
  if (f.shape?.length) sp.set('forma', f.shape.map((v) => slugOf(SHAPES, v)).join(','))
  if (f.material?.length) sp.set('material', f.material.map((v) => slugOf(MATERIALS, v)).join(','))
  if (f.rim?.length) sp.set('tip', f.rim.map((v) => slugOf(RIMS, v)).join(','))
  if (f.audience?.length) sp.set('pentru', f.audience.map((v) => slugOf(AUDIENCES, v)).join(','))
  if (f.fit?.length) sp.set('latime', f.fit.join(','))
  if (f.color?.length) sp.set('culoare', f.color.join(','))
  if (f.feature?.length) sp.set('caracteristici', f.feature.join(','))
  const nums: [keyof CatalogFilters, string][] = [
    ['priceMin', 'pret-min'],
    ['priceMax', 'pret-max'],
    ['lensMin', 'lentila-min'],
    ['lensMax', 'lentila-max'],
    ['bridgeMin', 'punte-min'],
    ['bridgeMax', 'punte-max'],
    ['templeMin', 'brat-min'],
    ['templeMax', 'brat-max'],
  ]
  for (const [k, key] of nums) {
    const v = f[k]
    if (typeof v === 'number') sp.set(key, String(v))
  }
  if (f.q) sp.set('q', f.q)
  if (f.sort && f.sort !== 'recomandate') sp.set('ordonare', f.sort)
  if (f.page && f.page > 1) sp.set('pagina', String(f.page))
  const s = sp.toString()
  return s ? `?${s.replace(/%2C/g, ',')}` : ''
}

export function activeFilterCount(f: CatalogFilters): number {
  return (
    f.shape.length +
    f.material.length +
    f.rim.length +
    f.audience.length +
    f.fit.length +
    f.color.length +
    f.feature.length +
    (f.priceMin !== null || f.priceMax !== null ? 1 : 0) +
    (f.lensMin !== null || f.lensMax !== null ? 1 : 0) +
    (f.bridgeMin !== null || f.bridgeMax !== null ? 1 : 0) +
    (f.templeMin !== null || f.templeMax !== null ? 1 : 0)
  )
}

export const PAGE_SIZE = 24
