import type { Metadata } from 'next'
import { CatalogPage } from '@/components/catalog/catalog-page'
import { SUN_LANDINGS } from '@/lib/catalog-landings'

export const metadata: Metadata = {
  title: 'Ochelari de soare — polarizați, UV400, și cu dioptrii',
  description: 'Ochelari de soare cu categoria filtrului și protecție UV400 pe fiecare model. Polarizați, degradé, oglindă — și cu lentile pe dioptria ta.',
  alternates: { canonical: '/ochelari-de-soare' },
}

export default function Page({ searchParams }: PageProps<'/ochelari-de-soare'>) {
  return <CatalogPage category="sun" searchParams={searchParams} landings={SUN_LANDINGS} />
}
