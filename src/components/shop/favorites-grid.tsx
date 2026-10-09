'use client'

import Link from 'next/link'
import type { ProductCard as Card } from '@/lib/catalog-query'
import { useFavorites } from '@/lib/favorites'
import { ProductCard } from './product-card'

export function FavoritesGrid({ products }: { products: Card[] }) {
  const fav = useFavorites()
  const items = fav.list.map((slug) => products.find((p) => p.slug === slug)).filter((p): p is Card => !!p)
  if (!items.length)
    return (
      <div className="card mt-10 flex flex-col items-center px-6 py-20 text-center">
        <div aria-hidden className="chart-row text-[64px] text-ink/60 blur-[5px]">♡</div>
        <h2 className="disp mt-4 text-[32px]">Nicio ramă salvată.</h2>
        <p className="mt-2 text-graphite">Apasă inima de pe orice ramă ca s-o găsești aici. Le păstrăm pe acest dispozitiv.</p>
        <Link href="/rame-de-vedere" className="btn btn-primary mt-6">Vezi ramele</Link>
      </div>
    )
  return (
    <ul className="mt-10 grid grid-cols-1 gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((p) => (
        <li key={p.id}><ProductCard product={p} /></li>
      ))}
    </ul>
  )
}
