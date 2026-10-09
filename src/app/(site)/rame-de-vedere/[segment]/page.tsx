import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CatalogPage } from '@/components/catalog/catalog-page'
import { findLanding, OPTICAL_LANDINGS } from '@/lib/catalog-landings'

export function generateStaticParams() {
  return OPTICAL_LANDINGS.map((l) => ({ segment: l.slug }))
}

export async function generateMetadata({ params }: PageProps<'/rame-de-vedere/[segment]'>): Promise<Metadata> {
  const l = findLanding('optical', (await params).segment)
  if (!l) return {}
  return { title: l.title, description: l.description, alternates: { canonical: `/rame-de-vedere/${l.slug}` } }
}

export default async function Page({ params, searchParams }: PageProps<'/rame-de-vedere/[segment]'>) {
  const l = findLanding('optical', (await params).segment)
  if (!l) notFound()
  return <CatalogPage category="optical" searchParams={searchParams} landing={l} landings={OPTICAL_LANDINGS} />
}
