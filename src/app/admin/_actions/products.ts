'use server'

import { and, eq, inArray, ne, notInArray, sql } from 'drizzle-orm'
import { refresh, updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { inventory, product, productImage, stockMovement, variant } from '@/lib/db/schema'
import { ceMarkingOf, frameWidthOf, highlightsOf, metaOf, modelCodeOf, productNameOf, searchTextOf, skuOf } from '@/lib/product-derive'
import { productInput } from '@/lib/product-input'
import { slugify } from '@/lib/text'
import { audit } from '@/server/audit'
import { requireStaff } from '@/server/session'
import { deleteObject, storePublicFile } from '@/server/storage'

type R = { ok: boolean; message?: string; error?: string; fieldErrors?: Record<string, string>; variantIds?: string[] }
const bani = (lei: number) => Math.round(lei * 100)

function invalidate(slug?: string, productId?: string) {
  updateTag('products')
  updateTag('stock')
  if (slug) updateTag(`product:${slug}`)
  if (productId) updateTag(`stock:${productId}`)
}

export async function saveProduct(productId: string | null, _: unknown, fd: FormData): Promise<R> {
  const me = await requireStaff('catalog:write')
  let raw: unknown
  try {
    raw = JSON.parse(String(fd.get('payload') ?? ''))
  } catch {
    return { ok: false, error: 'Date invalide.' }
  }
  const parsed = productInput.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const i of parsed.error.issues) {
      const k = i.path.join('.') || 'produs'
      fieldErrors[k] ??= i.message
    }
    return { ok: false, error: 'Verifică câmpurile marcate.', fieldErrors }
  }
  const p = parsed.data
  const name = productNameOf(p)
  const modelCode = modelCodeOf(p)
  const slug = p.slug || slugify(name)
  const price = bani(p.price)
  const derivedMeta = metaOf({ ...p, name, price })
  const values = {
    slug,
    name,
    family: p.family,
    modelCode,
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
    frameWidth: frameWidthOf(p),
    weightGrams: p.weightGrams ?? null,
    geometry: p.geometry,
    tagline: p.tagline || null,
    description: p.description || null,
    highlights: p.highlights.length ? p.highlights : highlightsOf(p),
    features: p.features,
    filterCategory: p.category === 'sun' ? (p.filterCategory ?? null) : null,
    polarized: p.category === 'sun' && p.polarized,
    price,
    compareAtPrice: p.compareAtPrice != null ? bani(p.compareAtPrice) : null,
    wholesalePrice: p.wholesalePrice != null ? bani(p.wholesalePrice) : null,
    vatClass: p.vatClass,
    badge: p.badge || null,
    featured: p.featured,
    manufacturer: p.manufacturer || null,
    countryOfOrigin: p.countryOfOrigin || null,
    ceMarking: p.ceMarking || ceMarkingOf(p),
    searchText: searchTextOf({ ...p, name, modelCode, colors: p.variants.map((v) => v.colorName) }),
    metaTitle: p.metaTitle || derivedMeta.title,
    metaDescription: p.metaDescription || derivedMeta.description,
    updatedAt: new Date(),
  }

  // uniqueness — friendly errors instead of constraint violations
  const clash = await db
    .select({ id: product.id, slug: product.slug, modelCode: product.modelCode })
    .from(product)
    .where(and(sql`(${product.slug} = ${slug} or ${product.modelCode} = ${modelCode})`, productId ? ne(product.id, productId) : undefined))
    .limit(1)
  if (clash[0]) return { ok: false, error: 'Există deja un produs cu același nume / cod.', fieldErrors: clash[0].slug === slug ? { slug: `Adresa /${slug} este folosită de alt produs.` } : { family: `Codul ${modelCode} există deja (aceeași familie și lățime).` } }
  const skus = p.variants.map((v) => skuOf(modelCode, v.colorCode))
  const skuClash = await db.select({ sku: variant.sku }).from(variant).where(and(inArray(variant.sku, skus), productId ? ne(variant.productId, productId) : undefined)).limit(1)
  if (skuClash[0]) return { ok: false, error: `SKU ${skuClash[0].sku} există deja la alt produs.` }

  const defaultIdx = Math.max(0, p.variants.findIndex((v) => v.isDefault && v.active))
  let id = productId
  let prevSlug: string | undefined
  const keep: string[] = []
  try {
    await db.transaction(async (tx) => {
      if (id) {
        const prev = await tx.query.product.findFirst({ where: eq(product.id, id), columns: { slug: true, status: true, publishedAt: true } })
        if (!prev) throw new Error('missing')
        prevSlug = prev.slug
        await tx.update(product).set({ ...values, publishedAt: p.status === 'active' && !prev.publishedAt ? new Date() : undefined }).where(eq(product.id, id))
      } else {
        const [row] = await tx.insert(product).values({ ...values, position: 999, publishedAt: p.status === 'active' ? new Date() : null }).returning({ id: product.id })
        id = row!.id
      }
      keep.length = 0
      for (const [i, v] of p.variants.entries()) {
        const vv = {
          productId: id!,
          sku: skuOf(modelCode, v.colorCode),
          ean: v.ean || null,
          colorName: v.colorName,
          colorSlug: slugify(v.colorName),
          colorFamily: v.colorFamily,
          swatch: v.swatch,
          priceDelta: bani(v.priceDelta ?? 0),
          position: i,
          isDefault: i === defaultIdx,
          active: v.active,
          updatedAt: new Date(),
        }
        let vid = v.id
        if (vid) {
          const res = await tx.update(variant).set(vv).where(and(eq(variant.id, vid), eq(variant.productId, id!))).returning({ id: variant.id })
          if (!res.length) vid = undefined
        }
        if (!vid) {
          const [row] = await tx.insert(variant).values(vv).returning({ id: variant.id })
          vid = row!.id
        }
        keep.push(vid)
        for (const [locationId, s] of Object.entries(v.stock)) {
          const cur = await tx.query.inventory.findFirst({ where: and(eq(inventory.variantId, vid), eq(inventory.locationId, locationId)) })
          if (cur && s.onHand < cur.reserved) throw new StockError(`${v.colorName}: stocul nu poate fi sub cantitatea rezervată (${cur.reserved}).`)
          const delta = s.onHand - (cur?.onHand ?? 0)
          await tx.insert(inventory).values({ variantId: vid, locationId, onHand: s.onHand, reorderPoint: s.reorderPoint }).onConflictDoUpdate({ target: [inventory.variantId, inventory.locationId], set: { onHand: s.onHand, reorderPoint: s.reorderPoint } })
          if (delta) await tx.insert(stockMovement).values({ variantId: vid, locationId, delta, reason: 'adjustment', reference: 'admin', actorId: me.id })
        }
      }
      // variants removed in the editor are deactivated (order history keeps pointing at them)
      await tx.update(variant).set({ active: false, isDefault: false }).where(and(eq(variant.productId, id!), notInArray(variant.id, keep)))
    })
  } catch (e) {
    if (e instanceof StockError) return { ok: false, error: e.message }
    console.error(e)
    return { ok: false, error: 'Nu am putut salva produsul.' }
  }
  await audit(me, productId ? 'product.update' : 'product.create', 'product', id, { slug, status: p.status })
  invalidate(slug, id!)
  if (prevSlug && prevSlug !== slug) updateTag(`product:${prevSlug}`)
  if (!productId) redirect(`/admin/produse/${id}?nou=1`)
  refresh()
  return { ok: true, message: 'Produs salvat. Magazinul s-a actualizat.', variantIds: keep }
}

class StockError extends Error {}

export async function setProductStatus(id: string, status: 'draft' | 'active' | 'archived'): Promise<R> {
  const me = await requireStaff('catalog:write')
  const [row] = await db.update(product).set({ status, updatedAt: new Date(), publishedAt: status === 'active' ? sql`coalesce(${product.publishedAt}, now())` : undefined }).where(eq(product.id, id)).returning({ slug: product.slug })
  if (!row) return { ok: false, error: 'Produsul nu există.' }
  await audit(me, 'product.status', 'product', id, { status })
  invalidate(row.slug, id)
  refresh()
  return { ok: true, message: status === 'active' ? 'Publicat.' : status === 'archived' ? 'Arhivat.' : 'Trecut în ciornă.' }
}

export async function duplicateProduct(id: string): Promise<R> {
  const me = await requireStaff('catalog:write')
  const src = await db.query.product.findFirst({ where: eq(product.id, id), with: { variants: true } })
  if (!src) return { ok: false, error: 'Produsul nu există.' }
  const suffix = Math.random().toString(36).slice(2, 6)
  const { id: _id, createdAt: _c, updatedAt: _u, variants, ...rest } = src
  const [copy] = await db
    .insert(product)
    .values({ ...rest, slug: `${src.slug}-copie-${suffix}`, modelCode: `${src.modelCode}-C${suffix.toUpperCase()}`, name: `${src.name} (copie)`, status: 'draft', featured: false, publishedAt: null })
    .returning({ id: product.id })
  for (const v of variants) {
    const { id: _vid, createdAt: _vc, updatedAt: _vu, productId: _p, ...vr } = v
    await db.insert(variant).values({ ...vr, productId: copy!.id, sku: `${v.sku}-C${suffix.toUpperCase()}` })
  }
  await audit(me, 'product.duplicate', 'product', copy!.id, { from: id })
  redirect(`/admin/produse/${copy!.id}`)
}

export async function uploadProductImages(productId: string, _: unknown, fd: FormData): Promise<R> {
  const me = await requireStaff('catalog:write')
  const files = fd.getAll('images').filter((f): f is File => f instanceof File && f.size > 0)
  if (!files.length) return { ok: false, error: 'Alege cel puțin o imagine.' }
  const p = await db.query.product.findFirst({ where: eq(product.id, productId), columns: { slug: true, name: true } })
  if (!p) return { ok: false, error: 'Produsul nu există.' }
  const variantId = String(fd.get('variantId') ?? '') || null
  const kind = ['packshot', 'lifestyle', 'detail'].includes(String(fd.get('kind'))) ? String(fd.get('kind')) : 'packshot'
  const [{ max } = { max: 0 }] = await db.select({ max: sql<number>`coalesce(max(${productImage.position}), -1)::int` }).from(productImage).where(eq(productImage.productId, productId))
  let pos = max + 1
  try {
    for (const f of files.slice(0, 12)) {
      const { key } = await storePublicFile(f, `products/${p.slug}`)
      const dims = await imageSize(f)
      await db.insert(productImage).values({ productId, variantId, key, alt: String(fd.get('alt') || p.name), kind, position: pos++, width: dims?.w ?? null, height: dims?.h ?? null })
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Încărcarea a eșuat.' }
  }
  await audit(me, 'product.images', 'product', productId, { n: files.length })
  invalidate(p.slug, productId)
  refresh()
  return { ok: true, message: `${files.length === 1 ? 'O imagine încărcată' : `${files.length} imagini încărcate`}.` }
}

export async function deleteProductImage(imageId: string): Promise<R> {
  const me = await requireStaff('catalog:write')
  const [img] = await db.delete(productImage).where(eq(productImage.id, imageId)).returning()
  if (!img) return { ok: false, error: 'Imaginea nu există.' }
  await deleteObject(img.key).catch(() => {})
  await audit(me, 'product.image.delete', 'product', img.productId)
  updateTag('products')
  refresh()
  return { ok: true }
}

export async function moveProductImage(imageId: string, dir: -1 | 1): Promise<R> {
  await requireStaff('catalog:write')
  const img = await db.query.productImage.findFirst({ where: eq(productImage.id, imageId) })
  if (!img) return { ok: false }
  const all = await db.query.productImage.findMany({ where: eq(productImage.productId, img.productId), orderBy: (t, { asc }) => asc(t.position) })
  const i = all.findIndex((x) => x.id === imageId)
  const j = i + dir
  if (j < 0 || j >= all.length) return { ok: true }
  ;[all[i], all[j]] = [all[j]!, all[i]!]
  await db.transaction(async (tx) => {
    for (const [k, x] of all.entries()) await tx.update(productImage).set({ position: k }).where(eq(productImage.id, x.id))
  })
  updateTag('products')
  refresh()
  return { ok: true }
}

/** Read pixel size from PNG/JPEG/WebP headers (no native deps). */
async function imageSize(f: File): Promise<{ w: number; h: number } | null> {
  const b = Buffer.from(await f.slice(0, 256 * 1024).arrayBuffer())
  if (b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG') return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = b.toString('ascii', 12, 16)
    if (chunk === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) }
    if (chunk === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff }
    if (chunk === 'VP8L') {
      const bits = b.readUInt32LE(21)
      return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 }
    }
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let o = 2
    while (o < b.length - 9) {
      if (b[o] !== 0xff) return null
      const m = b[o + 1]!
      const len = b.readUInt16BE(o + 2)
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(o + 7), h: b.readUInt16BE(o + 5) }
      o += 2 + len
    }
  }
  return null
}
