import type { Metadata } from 'next'
import { FavoritesGrid } from '@/components/shop/favorites-grid'
import { getCatalog } from '@/server/catalog'

export const metadata: Metadata = { title: 'Favorite', robots: { index: false } }

export default async function FavoritesPage() {
  const products = await getCatalog('all')
  return (
    <div className="container-x pb-10 pt-12">
      <div className="eyebrow">Favorite</div>
      <h1 className="disp mt-3 text-[clamp(44px,6vw,88px)]">Ramele tale.</h1>
      <FavoritesGrid products={products} />
    </div>
  )
}
