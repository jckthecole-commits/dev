import type { Metadata } from 'next'
import { FaqList, Showroom } from '@/components/home/sections'
import { JsonLd } from '@/components/seo/json-ld'
import { breadcrumbLd, opticianLd } from '@/lib/seo'
import { getFaqs } from '@/server/content'
import { getSettings } from '@/server/settings'

export const metadata: Metadata = {
  title: 'Optică Galați — showroom Sifra Vision, Str. Alexandru Cernat 188',
  description: 'Showroom de optică în Galați: probă rame, consultație optometrică, măsurare PD, montaj lentile și ajustare ochelari. Str. Alexandru Cernat 188.',
  alternates: { canonical: '/showroom-galati' },
}

export default async function ShowroomPage() {
  const [settings, faqs] = await Promise.all([getSettings(), getFaqs()])
  return (
    <div className="pt-6">
      <JsonLd data={[opticianLd(settings), breadcrumbLd([{ name: 'Acasă', path: '/' }, { name: 'Showroom Galați', path: '/showroom-galati' }])]} />
      <section className="container-x pt-6">
        <div className="eyebrow">Magazinul</div>
        <h1 className="disp mt-3 max-w-5xl text-[clamp(44px,6.4vw,100px)]">Optica din Galați unde vezi totul înainte să plătești.</h1>
      </section>
      <Showroom settings={settings} />
      <section className="container-x grid gap-4 py-10 md:grid-cols-3">
        {[
          ['Consultație optometrică', 'Acuitate vizuală, refracție și recomandări. Primești rețeta pe loc.'],
          ['Laborator de montaj', 'Tăiem și montăm lentilele în Galați, cu control al dioptriilor după montaj.'],
          ['Ajustare gratuită', 'Ajustăm și curățăm gratuit orice pereche de ochelari, chiar dacă nu e de la noi.'],
        ].map(([t, d]) => (
          <div key={t} className="card p-6"><h2 className="text-[18px] font-bold">{t}</h2><p className="mt-2 text-[15px] text-ink-2">{d}</p></div>
        ))}
      </section>
      <FaqList faqs={faqs.filter((f) => ['livrare', 'comanda'].includes(f.topic)).slice(0, 6)} />
    </div>
  )
}
