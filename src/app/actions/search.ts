'use server'

import { getCatalog } from '@/server/catalog'
import { getPublishedPosts } from '@/server/content'
import { normalizeSearch } from '@/lib/text'
import type { Swatch } from '@/lib/db/schema'
import type { FrameArtProduct } from '@/components/frame-art'

export type SearchHit = {
  slug: string
  name: string
  category: 'optical' | 'sun'
  price: number
  spec: string
  art: FrameArtProduct
  swatch: Swatch
}

export async function quickSearch(q: string): Promise<{ products: SearchHit[]; articles: { slug: string; title: string }[] }> {
  const tokens = normalizeSearch(q).split(' ').filter(Boolean).slice(0, 6)
  if (!tokens.length) return { products: [], articles: [] }
  const [all, posts] = await Promise.all([getCatalog('all'), getPublishedPosts('article')])
  const products = all
    .filter((p) => tokens.every((t) => p.searchText.includes(t)))
    .slice(0, 6)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      price: p.price,
      spec: `${p.lensWidth}□${p.bridgeWidth} ${p.templeLength} · ${p.material}`,
      art: { shape: p.shape as FrameArtProduct['shape'], lensWidth: p.lensWidth, lensHeight: p.lensHeight, bridgeWidth: p.bridgeWidth, rim: p.rim, material: p.material as FrameArtProduct['material'], geometry: p.geometry, category: p.category },
      swatch: p.variants[0]!.swatch,
    }))
  const articles = posts.filter((a) => tokens.every((t) => normalizeSearch(`${a.title} ${a.excerpt ?? ''}`).includes(t))).slice(0, 3).map((a) => ({ slug: a.slug, title: a.title }))
  return { products, articles }
}
