import type { Metadata } from 'next'
import { HeroFocus, type HeroFrame } from '@/components/home/hero'
import { B2BBand, Collection, FaqList, HowItWorks, JournalTeaser, SectionHead, ShapeBrowser, Showroom, TrustStrip, TryOnPromo } from '@/components/home/sections'
import { ThicknessLab } from '@/components/home/thickness-lab'
import { artOf } from '@/lib/product-art'
import { JsonLd } from '@/components/seo/json-ld'
import { formatFrameSize, formatPrice } from '@/lib/format'
import { faqLd, opticianLd } from '@/lib/seo'
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
  const heroProduct = optical.find((p) => p.slug === 'mira-52') ?? optical[0]!
  const heroVariant = heroProduct.variants[0]!
  const hero: HeroFrame = {
    slug: heroProduct.slug,
    name: heroProduct.name,
    colorName: heroVariant.colorName.replace(' translucid', ''),
    spec: `${formatFrameSize(heroProduct)} · ${heroProduct.weightGrams} g`,
    price: formatPrice(heroProduct.price),
    art: artOf(heroProduct),
    swatch: heroVariant.swatch,
  }
  const shapeCounts = optical.reduce<Record<string, number>>((acc, p) => ((acc[p.shape] = (acc[p.shape] ?? 0) + 1), acc), {})
  const featured = optical.filter((p) => p.featured).concat(optical.filter((p) => !p.featured)).slice(0, 8)
  const tryOnFrame = optical.find((p) => p.slug === 'iris-49') ?? optical[1]!

  return (
    <>
      <JsonLd data={[opticianLd(settings), faqLd(faqs.slice(0, 8))]} />
      <HeroFocus frame={hero} />
      <TrustStrip settings={settings} />
      <ShapeBrowser counts={shapeCounts} />
      <Collection products={featured} eyebrow="Colecția SIFRA" title="Rame care se poartă toată ziua." href="/rame-de-vedere" label="Vezi toate ramele" />

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
