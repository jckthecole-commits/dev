import type { Metadata } from 'next'
import { CatalogPage } from '@/components/catalog/catalog-page'
import { OPTICAL_LANDINGS } from '@/lib/catalog-landings'

export const metadata: Metadata = {
  title: 'Rame de vedere — cu lentile pe dioptria ta',
  description: 'Rame de vedere din acetat, titan și metal, cu dimensiuni reale pe fiecare model. Configurezi lentilele, vezi prețul complet și probezi virtual. Showroom în Galați.',
  alternates: { canonical: '/rame-de-vedere' },
}

export default function Page({ searchParams }: PageProps<'/rame-de-vedere'>) {
  return <CatalogPage category="optical" searchParams={searchParams} landings={OPTICAL_LANDINGS} />
}
