import type { Product, Variant } from './db/schema'
import type { ProductInput, VariantInput } from './product-input'

export type EditorLocation = { id: string; code: string; name: string; kind: string }
export type EditorReserved = Record<string, Record<string, number>> // variantId → locationId → reserved

export type Num = number | ''
export type EditorState = Omit<ProductInput, 'lensWidth' | 'bridgeWidth' | 'templeLength' | 'lensHeight' | 'weightGrams' | 'price' | 'compareAtPrice' | 'wholesalePrice'> & {
  lensWidth: Num
  bridgeWidth: Num
  templeLength: Num
  lensHeight: Num
  weightGrams: Num
  price: Num
  compareAtPrice: Num
  wholesalePrice: Num
}

export function newProductState(locations: EditorLocation[]): EditorState {
  return {
    family: '',
    category: 'optical',
    status: 'draft',
    audience: 'unisex',
    shape: 'rectangular',
    material: 'acetat',
    rim: 'full',
    lensWidth: 52,
    bridgeWidth: 18,
    templeLength: 145,
    lensHeight: 38,
    weightGrams: '',
    geometry: { rim: 4.6, bridgeStyle: 'keyhole' },
    tagline: '',
    description: '',
    highlights: [],
    features: [],
    filterCategory: null,
    polarized: false,
    price: '',
    compareAtPrice: '',
    wholesalePrice: '',
    vatClass: 'standard',
    badge: '',
    featured: false,
    manufacturer: 'Sifra Vision SRL',
    countryOfOrigin: '',
    ceMarking: '',
    metaTitle: '',
    metaDescription: '',
    variants: [newVariant(locations, true)],
  }
}

export function newVariant(locations: EditorLocation[], isDefault = false): VariantInput {
  return {
    colorName: isDefault ? 'Negru lucios' : '',
    colorCode: isDefault ? 'NGR' : '',
    colorFamily: 'negru',
    swatch: { kind: 'solid', primary: '#15181B' },
    ean: '',
    priceDelta: 0,
    active: true,
    isDefault,
    stock: Object.fromEntries(locations.map((l) => [l.id, { onHand: 0, reorderPoint: l.kind === 'store' ? 2 : 5 }])),
  }
}


/** Editor state from a stored product (prices bani → lei). */
export function productToState(p: Product, variants: Variant[], stock: { variantId: string; locationId: string; onHand: number; reorderPoint: number }[], locations: EditorLocation[]): EditorState {
  const lei = (b: number | null) => (b == null ? '' : b / 100)
  return {
    family: p.family,
    slug: p.slug,
    category: p.category,
    status: p.status,
    audience: p.audience,
    shape: p.shape,
    material: p.material,
    rim: p.rim,
    lensWidth: p.lensWidth,
    bridgeWidth: p.bridgeWidth,
    templeLength: p.templeLength,
    lensHeight: p.lensHeight,
    weightGrams: p.weightGrams ?? '',
    geometry: p.geometry,
    tagline: p.tagline ?? '',
    description: p.description ?? '',
    highlights: p.highlights,
    features: p.features,
    filterCategory: p.filterCategory,
    polarized: p.polarized,
    price: lei(p.price),
    compareAtPrice: lei(p.compareAtPrice),
    wholesalePrice: lei(p.wholesalePrice),
    vatClass: p.vatClass,
    badge: p.badge ?? '',
    featured: p.featured,
    manufacturer: p.manufacturer ?? '',
    countryOfOrigin: p.countryOfOrigin ?? '',
    ceMarking: p.ceMarking ?? '',
    metaTitle: p.metaTitle ?? '',
    metaDescription: p.metaDescription ?? '',
    variants: variants.map((v) => ({
      id: v.id,
      colorName: v.colorName,
      colorCode: v.sku.startsWith(`${p.modelCode}-`) ? v.sku.slice(p.modelCode.length + 1) : v.sku.split('-').pop()!,
      colorFamily: v.colorFamily as VariantInput['colorFamily'],
      swatch: v.swatch,
      ean: v.ean ?? '',
      priceDelta: v.priceDelta / 100,
      active: v.active,
      isDefault: v.isDefault,
      stock: Object.fromEntries(
        locations.map((l) => {
          const s = stock.find((x) => x.variantId === v.id && x.locationId === l.id)
          return [l.id, { onHand: s?.onHand ?? 0, reorderPoint: s?.reorderPoint ?? (l.kind === 'store' ? 2 : 5) }]
        }),
      ),
    })),
  }
}
