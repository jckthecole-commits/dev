import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Icon } from '@/components/icons'
import { TryOn, type TryOnFrame } from '@/components/tryon/try-on'
import { artOf } from '@/lib/product-art'
import { getCatalog } from '@/server/catalog'

export const metadata: Metadata = {
  title: 'Probă virtuală — probează ramele pe fața ta, la mărime reală',
  description: 'Probă virtuală de ochelari direct în browser: rame la mărimea reală, măsurarea distanței pupilare (PD) cu camera. Imaginile nu părăsesc telefonul.',
  alternates: { canonical: '/proba-virtuala' },
}

export default async function TryOnPage({ searchParams }: PageProps<'/proba-virtuala'>) {
  const all = await getCatalog('all')
  const frames: TryOnFrame[] = all.map((p) => ({
    slug: p.slug,
    name: p.name,
    category: p.category,
    price: p.price,
    art: artOf(p),
    variants: p.variants.map((v) => ({ colorName: v.colorName, colorSlug: v.colorSlug, swatch: v.swatch })),
  }))
  return (
    <div className="container-x pb-16 pt-10">
      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-end">
        <div>
          <div className="eyebrow">Probă virtuală · rulează în browser</div>
          <h1 className="disp mt-3 text-[clamp(44px,6vw,88px)]">Pe fața ta. La mărimea reală.</h1>
        </div>
        <ul className="flex flex-col gap-2 text-[14.5px] text-ink-2">
          <li className="flex items-center gap-2"><Icon name="lock" size={18} /> Imaginile nu părăsesc dispozitivul</li>
          <li className="flex items-center gap-2"><Icon name="ruler" size={18} /> Scară reală, din diametrul irisului</li>
          <li className="flex items-center gap-2"><Icon name="target" size={18} /> Măsurare PD inclusă</li>
        </ul>
      </div>
      <div className="mt-10">
        <Suspense fallback={<TryOn frames={frames} />}>
          <WithParams frames={frames} searchParams={searchParams} />
        </Suspense>
      </div>
      <section className="mt-20 grid gap-6 md:grid-cols-3">
        {[
          ['Cum funcționează', 'Un model de viziune computerizată găsește 478 de puncte pe fața ta. Irisul are în medie 11,7 mm diametru — îl folosim ca riglă, așa că rama apare în milimetri reali, nu „cât să încapă”.'],
          ['Cât de precis e PD-ul', 'De obicei ±1–2 mm. E suficient pentru lentile monofocale cu dioptrii mici-medii. La progresive și dioptrii mari îl confirmăm prin telefon sau în showroom.'],
          ['Confidențialitate', 'Totul rulează local, în browser. Nu încărcăm video, nu salvăm poze. Fotografiile de comparație rămân doar pe dispozitivul tău.'],
        ].map(([t, d]) => (
          <div key={t} className="card p-6">
            <h2 className="text-[17px] font-bold">{t}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{d}</p>
          </div>
        ))}
      </section>
    </div>
  )
}

async function WithParams({ frames, searchParams }: { frames: TryOnFrame[]; searchParams: PageProps<'/proba-virtuala'>['searchParams'] }) {
  const sp = await searchParams
  const s = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined)
  return <TryOn frames={frames} initialSlug={s('rama')} initialColor={s('culoare')} startWithPd={s('masoara') === 'pd'} />
}
