import type { Metadata } from 'next'
import Link from 'next/link'
import { SectionHead } from '@/components/home/sections'
import { ThicknessLab } from '@/components/home/thickness-lab'
import { Icon } from '@/components/icons'
import { formatDelta, formatPrice } from '@/lib/format'
import { lensTypeLabel } from '@/lib/pricing'
import { getLensCatalog } from '@/server/catalog'

export const metadata: Metadata = {
  title: 'Lentile de ochelari — monofocale, progresive, office, tratamente',
  description: 'Lentile de vedere monofocale, progresive și office, indice 1.50–1.74, antireflex, filtru lumină albastră, fotocromatice și polarizate. Prețuri transparente.',
  alternates: { canonical: '/lentile' },
}

export default async function LensesPage() {
  const c = await getLensCatalog()
  return (
    <div className="pb-10">
      <section className="container-x pt-12">
        <div className="eyebrow">Lentile · prețuri transparente</div>
        <h1 className="disp mt-3 max-w-5xl text-[clamp(44px,6.4vw,100px)]">Lentila contează mai mult decât rama.</h1>
        <p className="mt-6 max-w-2xl text-[18px] text-ink-2">Lucrăm cu producători certificați și montăm în laboratorul nostru din Galați. Toate prețurile de mai jos se adaugă la prețul ramei — fără costuri ascunse.</p>
      </section>
      <section className="container-x py-20">
        <SectionHead eyebrow="Tipuri" title="Ce lentile *ți se potrivesc?*" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {c.types.filter((t) => t.active && t.code !== 'none').map((t) => (
            <div key={t.code} className="card flex flex-col p-6">
              <div className="text-[19px] font-bold">{lensTypeLabel(t.code, 'optical', t.name)}</div>
              <p className="mt-2 flex-1 text-[15px] text-ink-2">{t.summary}</p>
              {t.minFittingHeight ? <p className="spec mt-3">rama ≥ {t.minFittingHeight} mm înălțime</p> : null}
              <div className="mt-4 border-t border-line pt-4 text-[17px] font-bold tnum">de la {formatPrice(t.price)}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="container-x py-10">
        <SectionHead eyebrow="Grosime" title="Indicele de refracție, *pe înțeles.*" intro="Mută dioptria și vezi cât de groasă iese marginea lentilei pe fiecare indice." action={{ href: '/jurnal/indicele-de-refractie-lentile-subtiate', label: 'Ghid complet' }} />
        <ThicknessLab indices={c.indices.filter((i) => i.active).map((i) => ({ code: i.code, name: i.name, price: i.price }))} />
      </section>
      <section className="container-x py-20">
        <SectionHead eyebrow="Tratamente" title="Ce poți *adăuga.*" />
        <ul className="divide-y divide-line border-y border-line">
          {c.treatments.filter((t) => t.active).map((t) => (
            <li key={t.code} className="grid gap-2 py-5 sm:grid-cols-[1fr_2fr_auto] sm:items-center">
              <span className="text-[17px] font-bold">{t.name}</span>
              <span className="text-[15px] text-ink-2">
                {t.summary}
                {t.categories.includes('sun') && !t.categories.includes('optical') ? ' · pentru ochelari de soare cu dioptrii' : ''}
              </span>
              <span className="text-[16px] font-bold tnum sm:text-right">{t.isDefault && t.price === 0 ? 'inclus' : formatDelta(t.price)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/rame-de-vedere" className="btn btn-primary">Alege rama <Icon name="arrow-right" size={18} /></Link>
          <Link href="/programare" className="btn btn-secondary">Nu știu ce-mi trebuie — vreau o consultație</Link>
        </div>
      </section>
    </div>
  )
}
