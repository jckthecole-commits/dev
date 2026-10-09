import 'server-only'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/lib/db'
import { inventory, location, lensIndex, lensTreatment, lensType, product, productImage, review, variant } from '@/lib/db/schema'
import type { ProductCard } from '@/lib/catalog-query'
import type { LensCatalog } from '@/lib/pricing'

/** All active products of a category with variants & sellable stock. Cached; invalidated by tag. */
export async function getCatalog(category: 'optical' | 'sun' | 'all' = 'all'): Promise<ProductCard[]> {
  'use cache'
  cacheTag('products')
  cacheLife('hours')

  const rows = await db
    .select()
    .from(product)
    .where(category === 'all' ? eq(product.status, 'active') : and(eq(product.status, 'active'), eq(product.category, category)))
    .orderBy(desc(product.featured), asc(product.position))
  if (!rows.length) return []
  const ids = rows.map((r) => r.id)

  const variants = await db
    .select({
      id: variant.id,
      productId: variant.productId,
      sku: variant.sku,
      colorName: variant.colorName,
      colorSlug: variant.colorSlug,
      colorFamily: variant.colorFamily,
      swatch: variant.swatch,
      priceDelta: variant.priceDelta,
      isDefault: variant.isDefault,
      position: variant.position,
      available: sql<number>`coalesce((select sum(greatest(i.on_hand - i.reserved, 0)) from inventory i join location l on l.id = i.location_id where i.variant_id = "variant"."id" and l.sellable), 0)::int`,
    })
    .from(variant)
    .where(and(inArray(variant.productId, ids), eq(variant.active, true)))
    .orderBy(asc(variant.position))

  const images = await db
    .select({ productId: productImage.productId, key: productImage.key, alt: productImage.alt, width: productImage.width, height: productImage.height, position: productImage.position })
    .from(productImage)
    .where(and(inArray(productImage.productId, ids), eq(productImage.kind, 'packshot')))
    .orderBy(asc(productImage.position))

  return rows.map((p) => {
    const img = images.find((i) => i.productId === p.id)
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      family: p.family,
      modelCode: p.modelCode,
      category: p.category,
      audience: p.audience,
      shape: p.shape,
      material: p.material,
      rim: p.rim,
      lensWidth: p.lensWidth,
      bridgeWidth: p.bridgeWidth,
      templeLength: p.templeLength,
      lensHeight: p.lensHeight,
      frameWidth: p.frameWidth,
      weightGrams: p.weightGrams,
      geometry: p.geometry,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      badge: p.badge,
      tagline: p.tagline,
      features: p.features,
      polarized: p.polarized,
      filterCategory: p.filterCategory,
      featured: p.featured,
      position: p.position,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      searchText: p.searchText,
      image: img ? { key: img.key, alt: img.alt, width: img.width, height: img.height } : null,
      variants: variants
        .filter((v) => v.productId === p.id)
        .map((v) => ({
          id: v.id,
          sku: v.sku,
          colorName: v.colorName,
          colorSlug: v.colorSlug,
          colorFamily: v.colorFamily,
          swatch: v.swatch,
          priceDelta: v.priceDelta,
          isDefault: v.isDefault,
          available: v.available,
        })),
    }
  })
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>

export async function getProductBySlug(slug: string) {
  'use cache'
  cacheTag('products', `product:${slug}`)
  cacheLife('hours')
  const p = await db.query.product.findFirst({
    where: and(eq(product.slug, slug), eq(product.status, 'active')),
    with: {
      variants: { where: eq(variant.active, true), orderBy: asc(variant.position) },
      images: { orderBy: asc(productImage.position) },
    },
  })
  if (!p) return null
  const siblings = await db
    .select({ slug: product.slug, name: product.name, lensWidth: product.lensWidth, bridgeWidth: product.bridgeWidth, templeLength: product.templeLength })
    .from(product)
    .where(and(eq(product.family, p.family), eq(product.status, 'active'), eq(product.category, p.category)))
    .orderBy(asc(product.lensWidth))
  const stats = await db
    .select({ count: sql<number>`count(*)::int`, avg: sql<number | null>`avg(${review.rating})::float` })
    .from(review)
    .where(and(eq(review.productId, p.id), eq(review.status, 'approved')))
  return { ...p, publishedAt: p.publishedAt?.toISOString() ?? null, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(), sizes: siblings, rating: { count: stats[0]?.count ?? 0, avg: stats[0]?.avg ?? null } }
}

/** Per-variant stock by location (for "în stoc în showroom"). Short-lived cache. */
export async function getStock(productId: string) {
  'use cache'
  cacheTag('stock', `stock:${productId}`)
  cacheLife('minutes')
  const rows = await db
    .select({ variantId: inventory.variantId, location: location.code, locationName: location.name, kind: location.kind, available: sql<number>`greatest(${inventory.onHand} - ${inventory.reserved}, 0)::int` })
    .from(inventory)
    .innerJoin(location, eq(location.id, inventory.locationId))
    .innerJoin(variant, eq(variant.id, inventory.variantId))
    .where(eq(variant.productId, productId))
  return rows
}

export async function getApprovedReviews(productId: string) {
  'use cache'
  cacheTag('reviews', `reviews:${productId}`)
  cacheLife('hours')
  return db
    .select({ id: review.id, name: review.name, city: review.city, rating: review.rating, title: review.title, body: review.body, fit: review.fit, verifiedPurchase: review.verifiedPurchase, reply: review.reply, createdAt: review.createdAt })
    .from(review)
    .where(and(eq(review.productId, productId), eq(review.status, 'approved')))
    .orderBy(desc(review.createdAt))
    .limit(30)
}

export async function getLensCatalog(): Promise<LensCatalog> {
  'use cache'
  cacheTag('lenses')
  cacheLife('hours')
  const [types, indices, treatments] = await Promise.all([
    db.select().from(lensType).orderBy(asc(lensType.position)),
    db.select().from(lensIndex).orderBy(asc(lensIndex.position)),
    db.select().from(lensTreatment).orderBy(asc(lensTreatment.position)),
  ])
  return {
    types: types.map((t) => ({ code: t.code, name: t.name, summary: t.summary, price: t.price, requiresPrescription: t.requiresPrescription, requiresAdd: t.requiresAdd, minFittingHeight: t.minFittingHeight, categories: t.categories, vatClass: t.vatClass, active: t.active })),
    indices: indices.map((i) => ({ code: i.code, name: i.name, summary: i.summary, price: i.price, refractiveIndex: i.refractiveIndex, recommendedUpTo: i.recommendedUpTo, lensTypes: i.lensTypes, active: i.active })),
    treatments: treatments.map((t) => ({ code: t.code, name: t.name, summary: t.summary, price: t.price, isDefault: t.isDefault, exclusiveGroup: t.exclusiveGroup, categories: t.categories, lensTypes: t.lensTypes, active: t.active })),
  }
}

/** Slugs prerendered at build (featured first); others render on demand (ISR). */
export async function getStaticProductSlugs(limit = 40) {
  try {
    const rows = await db.select({ slug: product.slug }).from(product).where(eq(product.status, 'active')).orderBy(desc(product.featured), asc(product.position)).limit(limit)
    return rows.length ? rows.map((r) => ({ slug: r.slug })) : [{ slug: '__none__' }]
  } catch {
    return [{ slug: '__none__' }]
  }
}
