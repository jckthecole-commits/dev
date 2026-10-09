import type { Metadata } from 'next'
import Link from 'next/link'
import { ApplyForm } from '@/components/b2b/apply-form'
import { Icon, type IconName } from '@/components/icons'

export const metadata: Metadata = {
  title: 'Distribuitor rame de ochelari — cont de partener pentru optici',
  description: 'Rame SIFRA en-gros pentru optici din toată România: prețuri pe niveluri, stoc în timp real, comandă rapidă pe cod de model și declarații de conformitate.',
  alternates: { canonical: '/b2b' },
}

const FEATURES: [IconName, string, string][] = [
  ['tag', 'Prețuri en-gros pe niveluri', 'Standard, Silver și Gold, în funcție de volum. Prețurile apar direct în portal, fără TVA.'],
  ['box', 'Stoc în timp real', 'Vezi exact câte bucăți sunt în depozit pe fiecare culoare înainte să comanzi.'],
  ['list', 'Comandă rapidă pe cod', 'Lipești lista de coduri și cantități din sistemul tău — comanda e gata în 10 secunde.'],
  ['file', 'Documente de conformitate', 'Declarații de conformitate, marcaje CE și fișe tehnice pentru fiecare model.'],
  ['truck', 'Livrare în 24–48 h', 'Expediem din depozitul din Galați, cu factură și AWB pe e-mail.'],
  ['refresh', 'Retur la defecte', 'Garanție de 24 de luni pentru defecte de fabricație, înlocuire rapidă.'],
]

export default function B2BPage() {
  return (
    <div className="pb-10">
      <section className="container-x pt-10">
        <div className="relative overflow-hidden rounded-[32px] bg-cobalt px-6 py-16 text-white sm:px-12 lg:py-24">
          <div className="eyebrow text-white/70">Pentru optici și magazine · B2B</div>
          <h1 className="disp mt-4 max-w-4xl text-[clamp(44px,6.4vw,96px)]">Ramele SIFRA, în vitrina ta.</h1>
          <p className="mt-6 max-w-2xl text-[18px] text-white/85">Distribuim colecția SIFRA către optici din toată România. Cont de partener cu prețuri en-gros, stoc vizibil și comenzi în câteva secunde.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#cerere" className="btn bg-white text-cobalt hover:bg-fog">Cere cont de partener</a>
            <Link href="/b2b/portal" className="btn text-white ring-[1.5px] ring-white/60 ring-inset hover:bg-white/10">Intră în portal</Link>
          </div>
          <div aria-hidden className="pointer-events-none absolute -right-28 -top-28 size-[420px] rounded-full border border-white/20" />
          <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 size-[240px] rounded-full border border-white/15" />
        </div>
      </section>
      <section className="container-x py-20">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([icon, title, text]) => (
            <li key={title} className="card focus-rise p-6">
              <span className="grid size-11 place-items-center rounded-[14px] bg-cobalt-50 text-cobalt"><Icon name={icon} /></span>
              <h2 className="mt-5 text-[18px] font-bold">{title}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{text}</p>
            </li>
          ))}
        </ul>
      </section>
      <section id="cerere" className="container-x grid scroll-mt-24 gap-10 lg:grid-cols-[1fr_1.5fr]">
        <div>
          <div className="eyebrow">Cerere de parteneriat</div>
          <h2 className="disp mt-3 text-[clamp(34px,4.4vw,58px)]">Începem cu o discuție.</h2>
          <ol className="mt-8 flex flex-col gap-5">
            {['Trimiți cererea (2 minute).', 'Verificăm firma și revenim cu nivelul de preț, în 1–2 zile.', 'Primești acces în portal și poți comanda imediat.'].map((t, i) => (
              <li key={t} className="flex gap-4">
                <span className="font-mono text-[13px] text-cobalt">0{i + 1}</span>
                <span className="text-[16px]">{t}</span>
              </li>
            ))}
          </ol>
        </div>
        <ApplyForm />
      </section>
    </div>
  )
}
