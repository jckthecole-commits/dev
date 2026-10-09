import type { Metadata } from 'next'
import { AnatomySection, type AnatomyData } from '@/components/home/anatomy'
import { HeroFocus, type HeroFrame } from '@/components/home/hero'
import { B2BBand, Collection, FaqList, HowItWorks, JournalTeaser, SectionHead, ShapeBrowser, Showroom, TrustStrip, TryOnPromo } from '@/components/home/sections'
import { ThicknessLab } from '@/components/home/thickness-lab'
import { artOf } from '@/lib/product-art'
import { JsonLd } from '@/components/seo/json-ld'
import { formatFrameSize, formatPrice } from '@/lib/format'
import { estimateThickness, formatDiopter } from '@/lib/optics'
import { faqLd, opticianLd } from '@/lib/seo'
import type { ProductCard } from '@/lib/catalog-query'
import { getCatalog, getLensCatalog } from '@/server/catalog'
import { getFaqs, getPublishedPosts } from '@/server/content'
import { getSettings } from '@/server/settings'

export const metadata: Metadata = {
  title: { absolute: 'Sifra Vision — rame de vedere și ochelari de soare · Galați' },
  alternates: { canonical: '/' },
}

export default async function HomePage() {
  const [settings, all, lenses, posts, faqs] = await Promise.all([getSettings(), getCatalog('all'), getLensCatalog(), getPublishedPosts('article'), getFaqs()])
  const optical = all.filter((p) => p.category === 'optical')
  const sun = all.filter((p) => p.category === 'sun')
  // hero showcase: four characters of the collection, each with its real colours
  const MATERIAL_RO: Record<string, string> = { acetat: 'acetat', metal: 'metal', titan: 'titan', tr90: 'TR90', combinat: 'acetat + metal' }
  const heroFrames: HeroFrame[] = ['mira-52', 'ada-53', 'iris-49', 'faleza-57']
    .map((slug) => all.find((p) => p.slug === slug))
    .filter((p): p is (typeof all)[number] => !!p)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      kind: p.category === 'sun' ? 'soare' : MATERIAL_RO[p.material] ?? p.material,
      spec: `${formatFrameSize(p)} · ${p.weightGrams} g`,
      price: formatPrice(p.price),
      art: artOf(p),
      templeLength: p.templeLength,
      variants: p.variants.map((v) => ({ name: v.colorName.replace(' translucid', ''), swatch: v.swatch })),
    }))
  if (!heroFrames.length && optical[0]) {
    const p = optical[0]
    heroFrames.push({ slug: p.slug, name: p.name, kind: p.material, spec: formatFrameSize(p), price: formatPrice(p.price), art: artOf(p), templeLength: p.templeLength, variants: p.variants.map((v) => ({ name: v.colorName, swatch: v.swatch })) })
  }
  const anatomy = anatomyOf(all.find((p) => p.slug === 'mira-52') ?? optical.find((p) => p.material === 'acetat'))
  const shapeCounts = optical.reduce<Record<string, number>>((acc, p) => ((acc[p.shape] = (acc[p.shape] ?? 0) + 1), acc), {})
  const featured = optical.filter((p) => p.featured).concat(optical.filter((p) => !p.featured)).slice(0, 8)
  const tryOnFrame = optical.find((p) => p.slug === 'iris-49') ?? optical[1]!

  return (
    <>
      <JsonLd data={[opticianLd(settings), faqLd(faqs.slice(0, 8))]} />
      <HeroFocus frames={heroFrames} />
      <TrustStrip settings={settings} />
      <ShapeBrowser counts={shapeCounts} />
      <Collection products={featured} eyebrow="Colecția SIFRA" title="Rame care se poartă toată ziua." href="/rame-de-vedere" label="Vezi toate ramele" />
      {anatomy ? <AnatomySection data={anatomy} /> : null}

      <section aria-labelledby="pret" className="container-x py-24">
        <SectionHead
          id="pret"
          eyebrow="Prețul complet, pe loc"
          title="Știi cât de groasă iese lentila. Înainte să plătești."
          intro="Mutăm dioptria și vedem secțiunea reală a lentilei pe fiecare indice. Nu vindem „cel mai subțire” din reflex — doar ce se vede diferit pe fața ta."
        />
        <ThicknessLab indices={lenses.indices.filter((i) => i.active).map((i) => ({ code: i.code, name: i.name, price: i.price }))} />
      </section>

      <TryOnPromo frame={tryOnFrame} />
      <HowItWorks />
      <Collection products={sun.slice(0, 4)} eyebrow="Ochelari de soare" title="Numiți după locurile unde îi porți." href="/ochelari-de-soare" label="Toți ochelarii de soare" />
      <Showroom settings={settings} />
      <B2BBand />
      <JournalTeaser posts={posts.slice(0, 3)} />
      <FaqList faqs={faqs.slice(0, 8)} />
    </>
  )
}

/** Exploded-view data for one frame — every number comes from the product sheet or the optics engine. */
function anatomyOf(p: ProductCard | undefined): AnatomyData | null {
  if (!p) return null
  const v = p.variants.find((x) => x.swatch.kind === 'havana') ?? p.variants.find((x) => x.isDefault) ?? p.variants[0]
  if (!v) return null
  const power = -4
  const frame = { lensWidth: p.lensWidth, bridgeWidth: p.bridgeWidth }
  const low = estimateThickness(power, '1.50', frame)
  const high = estimateThickness(power, '1.67', frame)
  const mm = (n: number) => n.toFixed(1).replace('.', ',')
  const knuckles = p.features.map((f) => /(\d+)\s*butoia/i.exec(f)?.[1]).find(Boolean)
  const MATERIAL: Record<string, string> = { acetat: 'Acetat', metal: 'Metal', titan: 'Titan', tr90: 'TR90', combinat: 'Acetat și metal' }
  return {
    slug: p.slug,
    name: p.name,
    colorName: v.colorName,
    price: formatPrice(p.price + v.priceDelta),
    art: artOf(p),
    swatch: v.swatch,
    templeLength: p.templeLength,
    frameWidth: p.frameWidth,
    lensWidth: p.lensWidth,
    lensHeight: p.lensHeight,
    bridgeWidth: p.bridgeWidth,
    weight: p.weightGrams,
    knuckles: knuckles ? Number(knuckles) : null,
    flex: p.features.includes('flex'),
    material: p.features.find((f) => /acetat|titan|metal/i.test(f)) ?? MATERIAL[p.material] ?? p.material,
    thickness: { power: formatDiopter(power), low: { index: '1.50', mm: mm(low.edge) }, high: { index: '1.67', mm: mm(high.edge) } },
  }
}
