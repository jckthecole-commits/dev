import type { MetadataRoute } from 'next'
import { and, eq } from 'drizzle-orm'
import { OPTICAL_LANDINGS, SUN_LANDINGS } from '@/lib/catalog-landings'
import { db } from '@/lib/db'
import { post, product, variant } from '@/lib/db/schema'
import { abs, frameImageUrl } from '@/lib/seo'

/** Products (with images), landing pages, journal and CMS pages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, variants, posts] = await Promise.all([
    db.select({ id: product.id, slug: product.slug, updatedAt: product.updatedAt, category: product.category }).from(product).where(eq(product.status, 'active')),
    db.select({ productId: variant.productId, colorSlug: variant.colorSlug }).from(variant).where(and(eq(variant.active, true))),
    db.select({ slug: post.slug, kind: post.kind, updatedAt: post.updatedAt }).from(post).where(eq(post.status, 'published')),
  ]).catch(() => [[], [], []] as const)
  const latest = (rows: readonly { updatedAt: Date }[]) => rows.reduce<Date | undefined>((m, r) => (!m || r.updatedAt > m ? r.updatedAt : m), undefined)
  const optical = products.filter((p) => p.category === 'optical')
  const sun = products.filter((p) => p.category === 'sun')

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: abs('/'), lastModified: latest(products), changeFrequency: 'daily', priority: 1 },
    { url: abs('/rame-de-vedere'), lastModified: latest(optical), changeFrequency: 'daily', priority: 0.9 },
    { url: abs('/ochelari-de-soare'), lastModified: latest(sun), changeFrequency: 'daily', priority: 0.9 },
    { url: abs('/lentile'), changeFrequency: 'monthly', priority: 0.8 },
    { url: abs('/proba-virtuala'), changeFrequency: 'monthly', priority: 0.7 },
    { url: abs('/programare'), changeFrequency: 'weekly', priority: 0.7 },
    { url: abs('/showroom-galati'), changeFrequency: 'monthly', priority: 0.8 },
    { url: abs('/conformitate'), changeFrequency: 'yearly', priority: 0.5 },
    { url: abs('/intrebari-frecvente'), changeFrequency: 'monthly', priority: 0.6 },
    { url: abs('/jurnal'), lastModified: latest(posts.filter((p) => p.kind === 'article')), changeFrequency: 'weekly', priority: 0.6 },
    { url: abs('/b2b'), changeFrequency: 'monthly', priority: 0.6 },
    { url: abs('/contact'), changeFrequency: 'yearly', priority: 0.5 },
  ]
  const landings: MetadataRoute.Sitemap = [
    ...OPTICAL_LANDINGS.map((l) => ({ url: abs(`/rame-de-vedere/${l.slug}`), lastModified: latest(optical), changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...SUN_LANDINGS.map((l) => ({ url: abs(`/ochelari-de-soare/${l.slug}`), lastModified: latest(sun), changeFrequency: 'weekly' as const, priority: 0.7 })),
  ]
  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: abs(`/rame/${p.slug}`),
    lastModified: p.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
    images: variants.filter((v) => v.productId === p.id).map((v) => frameImageUrl(p.slug, v.colorSlug)),
  }))
  const content: MetadataRoute.Sitemap = posts.map((p) => ({ url: abs(p.kind === 'article' ? `/jurnal/${p.slug}` : `/${p.slug}`), lastModified: p.updatedAt, changeFrequency: 'monthly', priority: p.kind === 'article' ? 0.6 : 0.3 }))
  return [...staticRoutes, ...landings, ...productRoutes, ...content]
}
