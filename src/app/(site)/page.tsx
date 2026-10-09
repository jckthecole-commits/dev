import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AnatomySection, type AnatomyData } from '@/components/home/anatomy'
import { CollectionRail, Manifesto, Marquee } from '@/components/home/motion-sections'
import { FramePit, type PitFrame } from '@/components/home/frame-pit'
import { HeroFocus, type HeroFrame } from '@/components/home/hero'
import { B2BBand, Collection, FaqList, HowItWorks, JournalTeaser, SectionHead, Showroom, TrustStrip, TryOnPromo } from '@/components/home/sections'
import { ShapeMorph, type MorphShape } from '@/components/home/shape-morph'
import { ThicknessLab } from '@/components/home/thickness-lab'
import { SHAPES } from '@/lib/catalog-filters'
import { OPTICAL_LANDINGS } from '@/lib/catalog-landings'
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
  const morphShapes = SHAPES.flatMap((sh): MorphShape[] => {
    const ex = optical.find((p) => p.shape === sh.value)
    if (!ex) return []
    const landing = OPTICAL_LANDINGS.find((l) => l.preset.shape?.length === 1 && l.preset.shape[0] === sh.value)
    return [
      {
        value: sh.value,
        plural: sh.plural,
        href: landing ? `/rame-de-vedere/${landing.slug}` : `/rame-de-vedere?forma=${sh.slug}`,
        count: shapeCounts[sh.value] ?? 0,
        intro: landing?.intro ?? SHAPE_NOTES[sh.value] ?? '',
        example: { name: ex.name, href: `/rame/${ex.slug}`, spec: artOf(ex) },
      },
    ]
  })
  const pitFrames: PitFrame[] = all.map((p, i) => {
    const v = p.variants.find((x) => x.isDefault) ?? p.variants[0]!
    return { slug: p.slug, name: p.name, price: formatPrice(p.price + v.priceDelta), src: v.art, box: p.artBox, pile: pileAt(i) }
  })
  const featured = optical.filter((p) => p.featured).concat(optical.filter((p) => !p.featured)).slice(0, 8)
  const tryOnFrame = optical.find((p) => p.slug === 'iris-49') ?? optical[1]!

  return (
    <>
      <JsonLd data={[opticianLd(settings), faqLd(faqs.slice(0, 8))]} />
      {/* the hero stays in the shell (it holds the LCP); every block below is its own Suspense
          boundary, so React hydrates them one by one and yields in between */}
      <HeroFocus frames={heroFrames} />
      <TrustStrip settings={settings} indices={indexRange(lenses.indices.filter((i) => i.active).map((i) => i.code))} />
      <Suspense>
        <ShapeMorph shapes={morphShapes} />
      </Suspense>
      <Suspense>
        <Marquee items={['Rame de vedere', 'Ochelari de soare', 'Lentile pe rețetă', 'Probă virtuală', 'Showroom Galați']} />
      </Suspense>
      <Suspense>
        <CollectionRail products={featured} eyebrow="Colecția SIFRA" title="Rame care se poartă *toată ziua.*" href="/rame-de-vedere" label="Vezi toate ramele" />
      </Suspense>
      <Suspense>
        <Manifesto />
      </Suspense>
      {anatomy ? (
        <Suspense>
          <AnatomySection data={anatomy} />
        </Suspense>
      ) : null}

      <section aria-labelledby="pret" className="cv-auto container-x py-24">
        <SectionHead
          id="pret"
          eyebrow="Prețul complet, pe loc"
          title="Știi cât de groasă iese lentila. *Înainte să plătești.*"
          intro="Mutăm dioptria și vedem secțiunea reală a lentilei pe fiecare indice. Nu vindem „cel mai subțire” din reflex — doar ce se vede diferit pe fața ta."
        />
        <Suspense>
          <ThicknessLab indices={lenses.indices.filter((i) => i.active).map((i) => ({ code: i.code, name: i.name, price: i.price }))} />
        </Suspense>
      </section>

      <Suspense>
        <FramePit frames={pitFrames} title="Toată colecția, *la grămadă.*" />
      </Suspense>
      <Suspense>
        <TryOnPromo frame={tryOnFrame} />
      </Suspense>
      <Suspense>
        <HowItWorks />
      </Suspense>
      <Suspense>
        <Collection products={sun.slice(0, 4)} eyebrow="Ochelari de soare" title="Numiți după locurile *unde îi porți.*" href="/ochelari-de-soare" label="Toți ochelarii de soare" />
      </Suspense>
      <Suspense>
        <Showroom settings={settings} />
      </Suspense>
      <B2BBand />
      <Suspense>
        <JournalTeaser posts={posts.slice(0, 3)} />
      </Suspense>
      <Suspense>
        <FaqList faqs={faqs.slice(0, 8)} />
      </Suspense>
    </>
  )
}

/** Lowest and highest active lens index, as written on the lens pages ("1.50", "1.74"). */
function indexRange(codes: string[]): [string, string] {
  const sorted = [...codes].sort((a, b) => parseFloat(a) - parseFloat(b))
  return [sorted[0] ?? '1.50', sorted[sorted.length - 1] ?? '1.74']
}

/** A still-life heap for the frame pit before (or without) its physics: deterministic, so server and client agree. */
function pileAt(i: number) {
  let seed = (i + 1) * 2654435761
  const rnd = () => ((seed = (seed ^ (seed >>> 15)) * 2246822519 + 0x9e3779b9) >>> 0) / 4294967296
  const perRow = 7
  const row = Math.floor(i / perRow)
  const col = i % perRow
  const x = 8 + ((col + 0.5) * 84) / perRow + (rnd() - 0.5) * 8 + (row % 2) * 5
  return { x: Math.round(x * 10) / 10, y: Math.round((row * 8 + rnd() * 3) * 10) / 10, r: Math.round((rnd() - 0.5) * 44) }
}

/** Shapes without their own landing page still get one honest line. */
const SHAPE_NOTES: Record<string, string> = {
  pilot: 'Forma de aviator: linie dreaptă sus, lentila coboară spre nas.',
  browline: 'Sprânceană groasă deasupra, fir subțire dedesubt — privirea vine în față.',
  geometric: 'Hexagoane și unghiuri tăiate, pentru o ramă care se observă.',
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
    img: { src: v.art, box: p.artBox },
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
