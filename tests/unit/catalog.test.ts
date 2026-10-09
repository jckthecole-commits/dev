import { describe, expect, it } from 'vitest'
import { activeFilterCount, filtersToQuery, parseFilters } from '@/lib/catalog-filters'
import { fitOf, queryCatalog, type ProductCard } from '@/lib/catalog-query'
import { colorCodeOf, frameWidthOf, modelCodeOf, skuOf } from '@/lib/product-derive'
import { productInput } from '@/lib/product-input'

describe('catalog filters ↔ URL', () => {
  it('parses Romanian slugs and round-trips', () => {
    const f = parseFilters(new URLSearchParams('forma=rotunde,cat-eye&material=titan&lentila-min=50&lentila-max=53&ordonare=pret-asc&pagina=2'))
    expect(f.shape).toEqual(['round', 'cat-eye'])
    expect(f.material).toEqual(['titan'])
    expect([f.lensMin, f.lensMax]).toEqual([50, 53])
    expect(f.page).toBe(2)
    expect(parseFilters(new URLSearchParams(filtersToQuery(f).slice(1)))).toEqual(f)
    expect(activeFilterCount(f)).toBe(4)
  })
  it('ignores junk and clamps the page', () => {
    const f = parseFilters({ forma: 'triunghi', pagina: '999', 'pret-min': 'abc' })
    expect(f.shape).toEqual([])
    expect(f.page).toBe(50)
    expect(f.priceMin).toBeNull()
  })
})

describe('catalog query', () => {
  const card = (o: Partial<ProductCard>): ProductCard => ({
    id: o.slug ?? 'x', slug: 'x', name: 'X', family: 'X', modelCode: 'SV-X', category: 'optical', audience: 'unisex', shape: 'round', material: 'acetat', rim: 'full', lensWidth: 50, bridgeWidth: 20, templeLength: 145, lensHeight: 40, frameWidth: 130, weightGrams: 18, geometry: { rim: 4, bridgeStyle: 'keyhole' }, price: 30000, compareAtPrice: null, badge: null, tagline: null, features: [], polarized: false, filterCategory: null, featured: false, position: 0, publishedAt: null, searchText: '', image: null,
    variants: [{ id: 'v', sku: 'S', colorName: 'Negru', colorSlug: 'negru', colorFamily: 'negru', swatch: { kind: 'solid', primary: '#000' }, priceDelta: 0, isDefault: true, available: 3 }],
    ...o,
  })
  const all = [card({ slug: 'a', lensWidth: 49, price: 20000 }), card({ slug: 'b', lensWidth: 52, shape: 'square', price: 35000 }), card({ slug: 'c', lensWidth: 55, price: 40000 })]
  it('filters by real dimensions and sorts by price', () => {
    const r = queryCatalog(all, parseFilters({ 'lentila-min': '50', ordonare: 'pret-desc' }))
    expect(r.items.map((p) => p.slug)).toEqual(['c', 'b'])
  })
  it('buckets frame width into fits', () => {
    expect(fitOf(124)).not.toBe(fitOf(142))
  })
})

describe('product derivation', () => {
  it('derives codes the way the catalogue does', () => {
    expect(modelCodeOf({ family: 'Brateș', lensWidth: 52, category: 'sun' })).toBe('SVS-BRATES-52')
    expect(skuOf('SV-MIRA-52', 'hvm')).toBe('SV-MIRA-52-HVM')
    expect(colorCodeOf('Havana miere')).toBe('HAM')
    expect(frameWidthOf({ lensWidth: 52, bridgeWidth: 18, material: 'acetat' })).toBe(132)
  })
  it('validates the admin payload', () => {
    const ok = productInput.safeParse({
      family: 'Test', category: 'optical', status: 'draft', audience: 'unisex', shape: 'round', material: 'acetat', rim: 'full', lensWidth: 50, bridgeWidth: 20, templeLength: 145, lensHeight: 40, weightGrams: '', geometry: { rim: 4, bridgeStyle: 'keyhole' }, highlights: [], features: [], polarized: false, price: 300, compareAtPrice: '', wholesalePrice: '', vatClass: 'standard', featured: false,
      variants: [{ colorName: 'Negru', colorCode: 'NGR', colorFamily: 'negru', swatch: { kind: 'solid', primary: '#000' }, ean: '', priceDelta: 0, active: true, isDefault: true, stock: {} }],
    })
    expect(ok.success).toBe(true)
    if (ok.success) expect([ok.data.compareAtPrice, ok.data.weightGrams]).toEqual([null, null])
    const sun = productInput.safeParse({ ...(ok.success ? ok.data : {}), category: 'sun', filterCategory: null })
    expect(sun.success).toBe(false)
  })
})
