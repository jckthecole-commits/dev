import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { productImage, variant } from '@/lib/db/schema'
import { MATERIAL_LABEL, SHAPE_LABEL } from '@/lib/product-derive'
import { abs, frameImageUrl } from '@/lib/seo'
import { getCatalog } from '@/server/catalog'
import { getSettings } from '@/server/settings'
import { publicUrl } from '@/server/storage'

/**
 * Google Merchant Center product feed (RSS 2.0 + g: namespace), one item per
 * colour variant, grouped by model (item_group_id). Prices include VAT.
 */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const money = (bani: number) => `${(bani / 100).toFixed(2)} RON`
const GENDER: Record<string, string> = { women: 'female', men: 'male', unisex: 'unisex', kids: 'unisex' }

export async function GET() {
  const [products, settings] = await Promise.all([getCatalog('all'), getSettings()])
  const ids = products.map((p) => p.id)
  const eans = new Map((ids.length ? await db.select({ id: variant.id, ean: variant.ean }).from(variant).where(inArray(variant.productId, ids)) : []).map((r) => [r.id, r.ean]))
  const photos = ids.length ? await db.select({ productId: productImage.productId, variantId: productImage.variantId, key: productImage.key, position: productImage.position }).from(productImage).where(and(inArray(productImage.productId, ids), eq(productImage.kind, 'packshot'))).orderBy(asc(productImage.position)) : []
  const ship = settings.shipping
  const items = products.flatMap((p) =>
    p.variants.map((v) => {
      const own = photos.filter((ph) => ph.productId === p.id && (ph.variantId === v.id || !ph.variantId))
      const image = own[0] ? abs(publicUrl(own[0].key)) : frameImageUrl(p.slug, v.colorSlug)
      const extra = own.slice(1, 10).map((ph) => abs(publicUrl(ph.key)))
      const kind = p.category === 'sun' ? 'Ochelari de soare' : 'Rame de vedere'
      const price = p.price + v.priceDelta
      const sale = p.compareAtPrice && p.compareAtPrice > price
      const title = `${p.name} — ${kind.toLowerCase()} ${MATERIAL_LABEL[p.material as keyof typeof MATERIAL_LABEL] ?? p.material}, ${v.colorName}`
      const description = `${(p.tagline ?? kind).replace(/\.$/, '')}. Dimensiuni ${p.lensWidth}-${p.bridgeWidth}-${p.templeLength} mm${p.weightGrams ? `, ${p.weightGrams} g` : ''}. ${p.category === 'sun' ? `Filtru categoria ${p.filterCategory ?? 3}, UV400${p.polarized ? ', polarizat' : ''}.` : 'Se poate comanda cu lentile pe dioptria ta.'} Probă virtuală online și showroom în Galați.`
      return `    <item>
      <g:id>${esc(v.sku)}</g:id>
      <g:item_group_id>${esc(p.modelCode)}</g:item_group_id>
      <title>${esc(title.slice(0, 150))}</title>
      <description>${esc(description.slice(0, 5000))}</description>
      <link>${esc(abs(`/rame/${p.slug}?culoare=${v.colorSlug}`))}</link>
      <g:image_link>${esc(image)}</g:image_link>${extra.map((u) => `\n      <g:additional_image_link>${esc(u)}</g:additional_image_link>`).join('')}
      <g:availability>${v.available > 0 ? 'in_stock' : 'out_of_stock'}</g:availability>
      <g:price>${money(sale ? p.compareAtPrice! : price)}</g:price>${sale ? `\n      <g:sale_price>${money(price)}</g:sale_price>` : ''}
      <g:condition>new</g:condition>
      <g:brand>SIFRA</g:brand>
      <g:mpn>${esc(v.sku)}</g:mpn>${eans.get(v.id) ? `\n      <g:gtin>${esc(eans.get(v.id)!)}</g:gtin>` : '\n      <g:identifier_exists>no</g:identifier_exists>'}
      <g:google_product_category>${p.category === 'sun' ? '178' : '524'}</g:google_product_category>
      <g:product_type>${esc(`${kind} > ${SHAPE_LABEL[p.shape as keyof typeof SHAPE_LABEL] ?? p.shape} > ${MATERIAL_LABEL[p.material as keyof typeof MATERIAL_LABEL] ?? p.material}`)}</g:product_type>
      <g:color>${esc(v.colorName)}</g:color>
      <g:material>${esc(MATERIAL_LABEL[p.material as keyof typeof MATERIAL_LABEL] ?? p.material)}</g:material>
      <g:gender>${GENDER[p.audience] ?? 'unisex'}</g:gender>
      <g:age_group>${p.audience === 'kids' ? 'kids' : 'adult'}</g:age_group>
      <g:size>${p.lensWidth}-${p.bridgeWidth}-${p.templeLength}</g:size>
      <g:product_detail><g:attribute_name>Lățime lentilă</g:attribute_name><g:attribute_value>${p.lensWidth} mm</g:attribute_value></g:product_detail>
      <g:product_detail><g:attribute_name>Punte</g:attribute_name><g:attribute_value>${p.bridgeWidth} mm</g:attribute_value></g:product_detail>
      <g:product_detail><g:attribute_name>Lungime braț</g:attribute_name><g:attribute_value>${p.templeLength} mm</g:attribute_value></g:product_detail>
      <g:shipping><g:country>RO</g:country><g:service>${esc(ship.courier.label)}</g:service><g:price>${money(price >= ship.freeThreshold ? 0 : ship.courier.price)}</g:price></g:shipping>
    </item>`
    }),
  )
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${esc(settings.company.brand)}</title>
    <link>${esc(abs('/'))}</link>
    <description>Rame de vedere și ochelari de soare SIFRA</description>
${items.join('\n')}
  </channel>
</rss>
`
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600, s-maxage=3600' } })
}
