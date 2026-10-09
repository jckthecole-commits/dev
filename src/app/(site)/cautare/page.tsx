import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { ProductCard } from '@/components/shop/product-card'
import { normalizeSearch } from '@/lib/text'
import { getCatalog } from '@/server/catalog'
import { getPublishedPosts } from '@/server/content'

export const metadata: Metadata = { title: 'Căutare', robots: { index: false, follow: true } }

export default function SearchPage({ searchParams }: PageProps<'/cautare'>) {
  return (
    <div className="container-x pb-10 pt-12">
      <Suspense fallback={<div className="skeleton h-20 w-1/2" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function Results({ searchParams }: PageProps<'/cautare'>) {
  const sp = await searchParams
  const q = typeof sp.q === 'string' ? sp.q.slice(0, 80) : ''
  const tokens = normalizeSearch(q).split(' ').filter(Boolean)
  const [all, posts] = await Promise.all([getCatalog('all'), getPublishedPosts('article')])
  const products = tokens.length ? all.filter((p) => tokens.every((t) => p.searchText.includes(t))) : []
  const articles = tokens.length ? posts.filter((a) => tokens.every((t) => normalizeSearch(`${a.title} ${a.excerpt ?? ''}`).includes(t))) : []
  return (
    <>
      <div className="eyebrow">Căutare</div>
      <h1 className="disp mt-3 text-[clamp(40px,5.4vw,80px)]">{q ? `„${q}”` : 'Caută.'}</h1>
      <form action="/cautare" role="search" className="mt-6 flex max-w-xl gap-2">
        <input name="q" defaultValue={q} placeholder="Formă, material, culoare, cod…" aria-label="Termen de căutare" className="field h-12 flex-1" />
        <button className="btn btn-ink">Caută</button>
      </form>
      <p className="mt-6 text-[15px]"><strong>{products.length}</strong> rame{articles.length ? ` · ${articles.length} ghiduri` : ''}</p>
      {products.length ? (
        <ul className="mt-6 grid grid-cols-1 gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => <li key={p.id}><ProductCard product={p} /></li>)}
        </ul>
      ) : q ? (
        <p className="mt-6 text-graphite">Nicio ramă pentru „{q}”. Încearcă <Link href="/cautare?q=rotunde" className="text-cobalt underline">rotunde</Link>, <Link href="/cautare?q=titan" className="text-cobalt underline">titan</Link> sau <Link href="/rame-de-vedere" className="text-cobalt underline">toate ramele</Link>.</p>
      ) : null}
      {articles.length ? (
        <ul className="mt-12 flex flex-col gap-2">
          {articles.map((a) => <li key={a.slug}><Link href={`/jurnal/${a.slug}`} className="text-[17px] font-bold text-cobalt">{a.title}</Link></li>)}
        </ul>
      ) : null}
    </>
  )
}
