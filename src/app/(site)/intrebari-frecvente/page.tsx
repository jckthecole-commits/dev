import type { Metadata } from 'next'
import { FaqList } from '@/components/home/sections'
import { JsonLd } from '@/components/seo/json-ld'
import { faqLd } from '@/lib/seo'
import { getFaqs } from '@/server/content'

export const metadata: Metadata = { title: 'Întrebări frecvente', description: 'Răspunsuri despre comenzi, rețete, lentile, livrare, retur și proba virtuală.', alternates: { canonical: '/intrebari-frecvente' } }

export default async function FaqPage() {
  const faqs = await getFaqs()
  return (
    <div className="pt-6">
      <JsonLd data={faqLd(faqs)} />
      <FaqList faqs={faqs} title="Întrebări frecvente" />
    </div>
  )
}
