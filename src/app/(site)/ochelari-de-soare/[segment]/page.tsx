import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CatalogPage } from '@/components/catalog/catalog-page'
import { findLanding, SUN_LANDINGS } from '@/lib/catalog-landings'

export function generateStaticParams() {
  return SUN_LANDINGS.map((l) => ({ segment: l.slug }))
}

export async function generateMetadata({ params }: PageProps<'/ochelari-de-soare/[segment]'>): Promise<Metadata> {
  const l = findLanding('sun', (await params).segment)
  if (!l) return {}
  return { title: l.title, description: l.description, alternates: { canonical: `/ochelari-de-soare/${l.slug}` } }
}

export default async function Page({ params, searchParams }: PageProps<'/ochelari-de-soare/[segment]'>) {
  const l = findLanding('sun', (await params).segment)
  if (!l) notFound()
  return <CatalogPage category="sun" searchParams={searchParams} landing={l} landings={SUN_LANDINGS} />
}
