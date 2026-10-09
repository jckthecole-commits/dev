/**
 * Derived product fields — shared by the seeder and the admin editor so a
 * product created by hand is indistinguishable from a catalogue import.
 */
import { normalizeSearch, slugify } from './text'

export const MATERIAL_LABEL = { acetat: 'acetat', metal: 'metal', titan: 'titan', tr90: 'TR90', combinat: 'acetat și metal' } as const
export const AUDIENCE_LABEL = { unisex: 'unisex', women: 'pentru femei', men: 'pentru bărbați', kids: 'pentru copii' } as const
export const SHAPE_LABEL = { rectangular: 'Rectangulară', square: 'Pătrată', round: 'Rotundă', oval: 'Ovală', 'cat-eye': 'Cat-eye', pilot: 'Pilot', browline: 'Browline', geometric: 'Geometrică' } as const
export const COLOR_FAMILIES = ['negru', 'havana', 'transparent', 'gri', 'albastru', 'verde', 'rosu', 'roz', 'maro', 'auriu', 'argintiu', 'bej'] as const

type Material = keyof typeof MATERIAL_LABEL
type Audience = keyof typeof AUDIENCE_LABEL

export function frameWidthOf(p: { lensWidth: number; bridgeWidth: number; material: Material }) {
  return Math.round(2 * p.lensWidth + p.bridgeWidth + (p.material === 'metal' || p.material === 'titan' ? 8 : 10))
}

export function modelCodeOf(p: { family: string; lensWidth: number; category: 'optical' | 'sun' }) {
  return `${p.category === 'sun' ? 'SVS' : 'SV'}-${slugify(p.family).toUpperCase()}-${p.lensWidth}`
}

export const productNameOf = (p: { family: string; lensWidth: number }) => `${p.family.trim()} ${p.lensWidth}`
export const skuOf = (modelCode: string, colorCode: string) => `${modelCode}-${colorCode.toUpperCase()}`
/** 3-letter colour code from a colour name: "Havana miere" → HVM */
export function colorCodeOf(name: string) {
  const words = slugify(name).split('-').filter(Boolean)
  if (!words.length) return 'XXX'
  if (words.length === 1) return words[0]!.replace(/[aeiou]/g, '').padEnd(3, words[0]!).slice(0, 3).toUpperCase()
  return (words[0]!.slice(0, 2) + words[1]![0]).toUpperCase()
}

export function searchTextOf(p: { name: string; family: string; modelCode: string; category: 'optical' | 'sun'; shape: string; material: Material; audience: Audience; tagline?: string | null; colors: string[] }) {
  const kind = p.category === 'sun' ? 'Ochelari de soare' : 'Rame de vedere'
  return normalizeSearch([p.name, p.family, p.modelCode, kind, p.shape, p.material, MATERIAL_LABEL[p.material], AUDIENCE_LABEL[p.audience], p.tagline ?? '', ...p.colors].join(' '))
}

export function highlightsOf(p: { lensWidth: number; bridgeWidth: number; templeLength: number; lensHeight: number; weightGrams?: number | null; material: Material; category: 'optical' | 'sun'; polarized?: boolean; filterCategory?: number | null }) {
  return [
    `${p.lensWidth}□${p.bridgeWidth} ${p.templeLength}${p.weightGrams ? ` · ${p.weightGrams} g` : ''}`,
    `Material: ${MATERIAL_LABEL[p.material]}`,
    p.lensHeight >= 28 && p.category === 'optical' ? 'Compatibilă cu lentile progresive' : null,
    p.polarized ? 'Lentile polarizate' : null,
    p.filterCategory ? `Categoria filtrului ${p.filterCategory} · UV400` : null,
  ].filter(Boolean) as string[]
}

export function ceMarkingOf(p: { category: 'optical' | 'sun'; filterCategory?: number | null }) {
  return p.category === 'sun' ? `CE · EN ISO 12312-1 · cat. ${p.filterCategory ?? 3} · UV400` : 'CE · dispozitiv medical clasa I (MDR 2017/745)'
}

export function metaOf(p: { name: string; category: 'optical' | 'sun'; material: Material; lensWidth: number; bridgeWidth: number; templeLength: number; weightGrams?: number | null; tagline?: string | null; price: number }) {
  const kind = p.category === 'sun' ? 'Ochelari de soare' : 'Rame de vedere'
  return {
    title: `${p.name} — ${kind.toLowerCase()} ${MATERIAL_LABEL[p.material]} ${p.lensWidth}□${p.bridgeWidth}`,
    description: `${p.tagline ? `${p.tagline} ` : ''}${kind} ${p.name}, ${p.lensWidth}□${p.bridgeWidth} ${p.templeLength}${p.weightGrams ? `, ${p.weightGrams} g` : ''}. Preț de la ${Math.round(p.price / 100)} lei, cu lentile pe dioptria ta. Probă virtuală și showroom în Galați.`,
  }
}
