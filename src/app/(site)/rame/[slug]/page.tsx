import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { SectionHead } from '@/components/home/sections'
import { cardView } from '@/lib/catalog-query'
import { Icon } from '@/components/icons'
import { ProductView, ProductViewWithParams, type PdpProduct } from '@/components/product/product-view'
import { Reviews } from '@/components/product/reviews'
import { SizeCompare } from '@/components/product/size-compare'
import { JsonLd } from '@/components/seo/json-ld'
import { ProductCard } from '@/components/shop/product-card'
import type { FrameSpec } from '@/lib/frame-geometry'
import { artOf } from '@/lib/product-art'
import { abs, breadcrumbLd, productGroupLd } from '@/lib/seo'
import { publicUrl } from '@/server/storage'
import { getApprovedReviews, getCatalog, getProductBySlug, getStaticProductSlugs, getStock } from '@/server/catalog'
import { getSettings } from '@/server/settings'

export async function generateStaticParams() {
  return getStaticProductSlugs()
}

export async function generateMetadata({ params }: PageProps<'/rame/[slug]'>): Promise<Metadata> {
  const p = await getProductBySlug((await params).slug)
  if (!p) return { title: 'Produs negăsit', robots: { index: false } }
  return {
    title: p.metaTitle ?? p.name,
    description: p.metaDescription ?? p.tagline ?? undefined,
    alternates: { canonical: `/rame/${p.slug}` },
    openGraph: { type: 'website', title: `${p.name} — Sifra Vision`, description: p.tagline ?? undefined, url: `/rame/${p.slug}` },
  }
}

export default async function ProductPage({ params }: Pick<PageProps<'/rame/[slug]'>, 'params'>) {
  const { slug } = await params
  const p = await getProductBySlug(slug)
  if (!p) notFound()
  const [settings, stock, reviews, all] = await Promise.all([getSettings(), getStock(p.id), getApprovedReviews(p.id), getCatalog(p.category)])

  const variants = p.variants.map((v) => {
    const rows = stock.filter((s) => s.variantId === v.id)
    return {
      id: v.id,
      sku: v.sku,
      ean: v.ean,
      colorName: v.colorName,
      colorSlug: v.colorSlug,
      swatch: v.swatch,
      priceDelta: v.priceDelta,
      stock: { showroom: rows.filter((r) => r.kind === 'store').reduce((s, r) => s + r.available, 0), warehouse: rows.filter((r) => r.kind !== 'store').reduce((s, r) => s + r.available, 0) },
    }
  })
  const view: PdpProduct = {
    id: p.id,
    slug: p.slug,
    name: p.name,
    family: p.family,
    category: p.category,
    tagline: p.tagline,
    badge: p.badge,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    lensWidth: p.lensWidth,
    bridgeWidth: p.bridgeWidth,
    templeLength: p.templeLength,
    lensHeight: p.lensHeight,
    frameWidth: p.frameWidth,
    weightGrams: p.weightGrams,
    material: p.material,
    filterCategory: p.filterCategory,
    polarized: p.polarized,
    art: artOf(p),
    knuckles: Number(p.features.map((f) => /(\d+)\s*butoia/i.exec(f)?.[1]).find(Boolean) ?? 0) || null,
    images: p.images.map((i) => ({ key: i.key, alt: i.alt, variantId: i.variantId })),
    variants: variants.map(({ ean: _e, ...v }) => v),
    sizes: p.sizes,
  }
  const base = p.category === 'sun' ? '/ochelari-de-soare' : '/rame-de-vedere'
  const crumbs = [
    { name: 'Acasă', path: '/' },
    { name: p.category === 'sun' ? 'Ochelari de soare' : 'Rame de vedere', path: base },
    { name: p.name, path: `/rame/${p.slug}` },
  ]
  const related = all.filter((x) => x.id !== p.id && (x.shape === p.shape || x.material === p.material)).slice(0, 4)
  const production = `${settings.policies.productionDaysMin}–${settings.policies.productionDaysMax}`

  return (
    <article className="container-x pb-8 pt-8">
      <JsonLd
        data={[
          productGroupLd(
            {
              slug: p.slug,
              name: p.name,
              description: p.description ?? p.tagline ?? p.name,
              modelCode: p.modelCode,
              category: p.category,
              material: p.material,
              shape: p.shape,
              audience: p.audience,
              lensWidth: p.lensWidth,
              bridgeWidth: p.bridgeWidth,
              templeLength: p.templeLength,
              weightGrams: p.weightGrams,
              price: p.price,
              variants: variants.map((v) => {
                const photo = p.images.find((i) => i.kind === 'packshot' && i.variantId === v.id) ?? p.images.find((i) => i.kind === 'packshot' && !i.variantId)
                return { sku: v.sku, colorName: v.colorName, colorSlug: v.colorSlug, ean: v.ean, available: v.stock.showroom + v.stock.warehouse, priceDelta: v.priceDelta, image: photo ? abs(publicUrl(photo.key)) : undefined }
              }),
              rating: p.rating,
            },
            settings,
          ),
          breadcrumbLd(crumbs),
        ]}
      />
      <nav aria-label="Breadcrumb" className="spec mb-6 flex flex-wrap items-center gap-1.5">
        {crumbs.map((c, i) => (
          <span key={c.path} className="flex items-center gap-1.5">
            {i > 0 ? <Icon name="chevron-right" size={12} /> : null}
            {i === crumbs.length - 1 ? <span aria-current="page">{c.name}</span> : <Link href={c.path} className="no-underline hover:text-ink">{c.name}</Link>}
          </span>
        ))}
      </nav>

      <Suspense fallback={<ProductView product={view} productionDays={production} />}>
        <ProductViewWithParams product={view} productionDays={production} />
      </Suspense>

      <Suspense>
        <section aria-label="Dimensiuni" className="cv-auto mt-28">
          <SizeCompare spec={{ ...(artOf(p) as FrameSpec) }} temple={p.templeLength} frameWidth={p.frameWidth} />
        </section>

        <section aria-labelledby="despre" className="mt-28 grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <div className="eyebrow">Despre model</div>
            <h2 id="despre" className="disp mt-3 text-[clamp(30px,3.6vw,46px)]">
              {p.tagline}
            </h2>
          </div>
          <div>
            <div className="prose-sv">
              {(p.description ?? '').split('\n\n').map((para) => (
                <p key={para.slice(0, 24)}>{para}</p>
              ))}
            </div>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {p.highlights.map((h) => (
                <li key={h} className="flex items-center gap-3 rounded-xl bg-glass px-4 py-3 text-[15px] ring-1 ring-line-soft">
                  <Icon name="check" size={18} className="shrink-0 text-cobalt" /> {h}
                </li>
              ))}
            </ul>
            <details className="group mt-8 rounded-2xl bg-glass ring-1 ring-line-soft">
              <summary className="flex items-center justify-between px-5 py-4 text-[15px] font-bold">
                <span className="flex items-center gap-2">
                  <Icon name="shield" size={20} /> Conformitate și siguranță
                </span>
                <Icon name="chevron-down" size={18} className="transition-transform group-open:rotate-180" />
              </summary>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 px-5 pb-5 text-[14.5px]">
                <dt className="text-graphite">Marcaj</dt>
                <dd>{p.ceMarking}</dd>
                <dt className="text-graphite">Producător / distribuitor</dt>
                <dd>
                  {p.manufacturer} · {settings.company.address}, {settings.company.city}, România
                </dd>
                <dt className="text-graphite">Origine</dt>
                <dd>{p.countryOfOrigin}</dd>
                <dt className="text-graphite">Cod model</dt>
                <dd className="font-mono">{p.modelCode}</dd>
                <dt className="text-graphite">Contact siguranță</dt>
                <dd>{settings.company.email}</dd>
              </dl>
              <p className="px-5 pb-5 text-[13px] text-graphite">
                {p.category === 'sun'
                  ? 'Nu sunt potriviți pentru privit direct la soare. Categoria 4 nu este potrivită pentru condus.'
                  : 'Ochelarii cu lentile pe rețetă sunt dispozitive medicale realizate la comandă. Detalii pe pagina '}
                {p.category === 'sun' ? null : (
                  <Link href="/conformitate" className="text-cobalt underline">
                    Conformitate
                  </Link>
                )}
                {p.category === 'sun' ? null : '.'}
              </p>
            </details>
          </div>
        </section>
      </Suspense>

      <Suspense>
        <div className="cv-auto mt-28">
          <Reviews productId={p.id} productName={p.name} reviews={reviews} rating={p.rating} />
        </div>
      </Suspense>

      {related.length ? (
        <Suspense>
          <section aria-label="Rame similare" className="cv-auto mt-28">
            <SectionHead eyebrow="Din aceeași familie de forme" title="Poate îți plac *și acestea.*" action={{ href: base, label: 'Toate modelele' }} />
            <div className="grid grid-cols-1 gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((r) => (
                <ProductCard key={r.id} product={cardView(r)} />
              ))}
            </div>
          </section>
        </Suspense>
      ) : null}
    </article>
  )
}
