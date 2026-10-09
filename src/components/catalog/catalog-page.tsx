import Link from 'next/link'
import { Suspense } from 'react'
import { Icon } from '@/components/icons'
import { JsonLd } from '@/components/seo/json-ld'
import { ProductCard } from '@/components/shop/product-card'
import { filtersToQuery, parseFilters, type CatalogFilters } from '@/lib/catalog-filters'
import { queryCatalog } from '@/lib/catalog-query'
import type { Landing } from '@/lib/catalog-landings'
import { abs, breadcrumbLd } from '@/lib/seo'
import { getCatalog } from '@/server/catalog'
import { ActiveChips, CatalogNav, FilterDrawerButton, FilterSidebar, ResultsShell, SortSelect } from './filter-panel'

type SP = Promise<Record<string, string | string[] | undefined>>

const LABEL = { optical: 'Rame de vedere', sun: 'Ochelari de soare' }
const BASE = { optical: '/rame-de-vedere', sun: '/ochelari-de-soare' }

export function CatalogPage({ category, searchParams, landing, landings }: { category: 'optical' | 'sun'; searchParams: SP; landing?: Landing | null; landings: Landing[] }) {
  const base = BASE[category]
  const crumbs = [
    { name: 'Acasă', path: '/' },
    { name: LABEL[category], path: base },
    ...(landing ? [{ name: landing.title, path: `${base}/${landing.slug}` }] : []),
  ]
  return (
    <div className="container-x pb-10 pt-8">
      <JsonLd data={breadcrumbLd(crumbs)} />
      <nav aria-label="Breadcrumb" className="spec mb-6 flex flex-wrap items-center gap-1.5">
        {crumbs.map((c, i) => (
          <span key={c.path} className="flex items-center gap-1.5">
            {i > 0 ? <Icon name="chevron-right" size={12} /> : null}
            {i === crumbs.length - 1 ? <span aria-current="page">{c.name}</span> : <Link href={c.path} className="no-underline hover:text-ink">{c.name}</Link>}
          </span>
        ))}
      </nav>
      <header className="grid gap-6 border-b border-line pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <h1 className="disp focus-reveal text-[clamp(44px,7vw,96px)]">{landing?.h1 ?? (category === 'optical' ? 'Rame de vedere.' : 'Ochelari de soare.')}</h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-ink-2">
            {landing?.intro ??
              (category === 'optical'
                ? 'Fiecare ramă are dimensiunile reale afișate și desenate la scară. Alege forma, apoi lentilele — prețul complet îl vezi înainte de coș.'
                : 'Categoria filtrului, UV400 și polarizarea sunt pe fiecare produs. Aproape toate pot primi și lentile cu dioptrii.')}
          </p>
        </div>
        <nav aria-label="Colecții" className="flex max-w-xl flex-wrap gap-2 lg:justify-end">
          {landings.map((l) => (
            <Link key={l.slug} href={`${base}/${l.slug}`} aria-current={landing?.slug === l.slug ? 'page' : undefined} className="rounded-full bg-glass px-3.5 py-1.5 text-[13.5px] no-underline ring-1 ring-line-soft hover:ring-ink aria-[current=page]:bg-ink aria-[current=page]:text-fog">
              {l.h1.replace(/\.$/, '')}
            </Link>
          ))}
        </nav>
      </header>
      <Suspense fallback={<ResultsSkeleton />}>
        <Results category={category} searchParams={searchParams} preset={landing?.preset} />
      </Suspense>
    </div>
  )
}

async function Results({ category, searchParams, preset }: { category: 'optical' | 'sun'; searchParams: SP; preset?: Partial<CatalogFilters> }) {
  const sp = await searchParams
  const parsed = parseFilters(sp)
  const filters: CatalogFilters = { ...parsed, ...mergePreset(parsed, preset) }
  const all = await getCatalog(category)
  const r = queryCatalog(all, filters)
  const base = BASE[category]
  return (
    <CatalogNav basePath={base}>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          numberOfItems: r.total,
          itemListElement: r.items.map((p, i) => ({ '@type': 'ListItem', position: (r.page - 1) * 24 + i + 1, url: abs(`/rame/${p.slug}`), name: p.name })),
        }}
      />
      <div className="grid gap-10 pt-8 lg:grid-cols-[272px_1fr]">
        <FilterSidebar filters={filters} facets={r.facets} category={category} />
        <div>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[15px]" aria-live="polite">
              <strong className="tnum">{r.total}</strong> {r.total === 1 ? 'model' : 'modele'}
            </p>
            <div className="flex items-center gap-2">
              <FilterDrawerButton filters={filters} facets={r.facets} category={category} total={r.total} />
              <SortSelect filters={filters} />
            </div>
          </div>
          <div className="mb-6">
            <ActiveChips filters={filters} />
          </div>
          <ResultsShell>
            {r.items.length ? (
              <ul className="grid grid-cols-1 gap-x-5 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
                {r.items.map((p, i) => (
                  <li key={p.id}>
                    <ProductCard product={p} eager={i < 3} initialVariant={filters.color.length ? p.variants.find((v) => filters.color.includes(v.colorFamily))?.id : undefined} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyResults base={base} />
            )}
          </ResultsShell>
          {r.pages > 1 ? (
            <nav aria-label="Paginare" className="mt-14 flex items-center justify-center gap-2">
              {Array.from({ length: r.pages }, (_, i) => i + 1).map((n) => (
                <Link key={n} href={`${base}${filtersToQuery({ ...filters, page: n })}`} aria-current={n === r.page ? 'page' : undefined} className="grid size-11 place-items-center rounded-full text-[15px] font-bold no-underline ring-1 ring-line aria-[current=page]:bg-ink aria-[current=page]:text-fog">
                  {n}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      </div>
    </CatalogNav>
  )
}

function mergePreset(f: CatalogFilters, preset?: Partial<CatalogFilters>): Partial<CatalogFilters> {
  if (!preset) return {}
  const out: Partial<CatalogFilters> = {}
  for (const [k, v] of Object.entries(preset) as [keyof CatalogFilters, unknown][]) {
    const cur = f[k]
    if (Array.isArray(v) && Array.isArray(cur)) (out as Record<string, unknown>)[k] = Array.from(new Set([...(v as string[]), ...(cur as string[])]))
    else (out as Record<string, unknown>)[k] = v
  }
  return out
}

function EmptyResults({ base }: { base: string }) {
  return (
    <div className="card flex flex-col items-center px-6 py-20 text-center">
      <div aria-hidden className="chart-row text-[56px] text-ink/70 blur-[4px]">
        ?
      </div>
      <h2 className="disp mt-4 text-[32px]">Nicio ramă nu se potrivește.</h2>
      <p className="mt-2 max-w-md text-graphite">Încearcă să scoți un filtru sau să lărgești intervalul de dimensiuni (±3 mm se simte foarte puțin).</p>
      <Link href={base} className="btn btn-ink mt-6">
        Vezi toate modelele
      </Link>
    </div>
  )
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-10 pt-8 lg:grid-cols-[272px_1fr]">
      <div className="hidden flex-col gap-3 lg:flex">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-12" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <div className="skeleton aspect-[5/4] rounded-[var(--radius-card)]" />
            <div className="skeleton h-5 w-2/3" />
            <div className="skeleton h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}
