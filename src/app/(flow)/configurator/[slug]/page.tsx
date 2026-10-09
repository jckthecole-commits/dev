import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Configurator, type ConfigFrame } from '@/components/configurator/configurator'
import { artOf } from '@/lib/product-art'
import { getLensCatalog, getProductBySlug, getStaticProductSlugs } from '@/server/catalog'
import { getSettings } from '@/server/settings'

export async function generateStaticParams() {
  return getStaticProductSlugs()
}

export async function generateMetadata({ params }: PageProps<'/configurator/[slug]'>): Promise<Metadata> {
  const p = await getProductBySlug((await params).slug)
  return { title: p ? `Configurează lentilele — ${p.name}` : 'Configurator', robots: { index: false, follow: true } }
}

export default async function ConfiguratorPage({ params, searchParams }: PageProps<'/configurator/[slug]'>) {
  const p = await getProductBySlug((await params).slug)
  if (!p) notFound()
  const [catalog, settings] = await Promise.all([getLensCatalog(), getSettings()])
  const frame: ConfigFrame = {
    slug: p.slug,
    name: p.name,
    category: p.category,
    price: p.price,
    lensWidth: p.lensWidth,
    bridgeWidth: p.bridgeWidth,
    templeLength: p.templeLength,
    lensHeight: p.lensHeight,
    rim: p.rim,
    vatClass: p.vatClass,
    art: artOf(p),
    variants: p.variants.map((v) => ({ id: v.id, colorName: v.colorName, colorSlug: v.colorSlug, swatch: v.swatch, priceDelta: v.priceDelta })),
  }
  const production = `${settings.policies.productionDaysMin}–${settings.policies.productionDaysMax}`
  return (
    <Suspense fallback={<Configurator frame={frame} catalog={catalog} vat={settings.vat} productionDays={production} />}>
      <WithColor searchParams={searchParams} frame={frame} catalog={catalog} vat={settings.vat} productionDays={production} />
    </Suspense>
  )
}

async function WithColor({ searchParams, ...rest }: { searchParams: PageProps<'/configurator/[slug]'>['searchParams'] } & Omit<React.ComponentProps<typeof Configurator>, 'initialColor'>) {
  const sp = await searchParams
  const c = typeof sp.culoare === 'string' ? sp.culoare : undefined
  return <Configurator key={c} {...rest} initialColor={c} />
}
