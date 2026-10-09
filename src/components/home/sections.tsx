import Link from 'next/link'
import { Icon } from '@/components/icons'
import { ProductCard } from '@/components/shop/product-card'
import { cardView, type ProductCard as Card } from '@/lib/catalog-query'
import { formatDate } from '@/lib/format'
import type { StoreSettings } from '@/lib/settings-schema'
import { WEEKDAYS_RO } from '@/lib/settings-schema'
import { OpenNow } from './open-now'

/** "Rame care se poartă *toată ziua.*" → the starred part set in the Bodoni italic accent. */
export function rich(text: string) {
  return text.split(/\*(.+?)\*/g).map((part, i) => (i % 2 ? <em key={i}>{part}</em> : part))
}

export function SectionHead({ eyebrow, title, intro, action, id }: { eyebrow?: string; title: string; intro?: string; action?: { href: string; label: string }; id?: string }) {
  return (
    <div className="mb-10 flex flex-col gap-5 md:mb-12 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? <div className="eyebrow mb-3">{eyebrow}</div> : null}
        <h2 id={id} data-split className="disp focus-reveal text-[clamp(34px,4.6vw,60px)]">
          {rich(title)}
        </h2>
        {intro ? <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-ink-2">{intro}</p> : null}
      </div>
      {action ? (
        <Link href={action.href} className="group inline-flex shrink-0 items-center gap-2 font-bold text-ink no-underline">
          <span className="nl">{action.label}</span>
          <Icon name="arrow-right" size={18} className="transition-transform group-hover:translate-x-1" />
        </Link>
      ) : null}
    </div>
  )
}

/** Four facts, set like a spec sheet: big figures, small print — every one of them checkable on the site. */
export function TrustStrip({ settings, indices }: { settings: StoreSettings; indices: [string, string] }) {
  const facts: { fig: React.ReactNode; title: string; text: string }[] = [
    { fig: '1:1', title: 'Desenate la scară', text: 'Fiecare ramă e trasă din cotele ei reale, în milimetri.' },
    { fig: <>{settings.policies.adaptationDays}<small>zile</small></>, title: 'Garanție de adaptare', text: 'Nu te obișnuiești cu lentilele? Le refacem.' },
    { fig: <>{indices[0]}<small>–{indices[1]}</small></>, title: 'Indici de lentile', text: 'Cu grosimea marginii calculată înainte să plătești.' },
    { fig: 'Rx', title: 'Optometrist pe fiecare comandă', text: 'Rețeta e verificată înainte de montaj. CE, MDR clasa I.' },
  ]
  return (
    <section aria-label="De ce Sifra Vision" className="facts">
      <ul className="container-x facts-grid">
        {facts.map((f) => (
          <li key={f.title}>
            <span className="fact-fig">{f.fig}</span>
            <span className="fact-title">{f.title}</span>
            <span className="fact-text">{f.text}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Collection({ products, title, eyebrow, href, label }: { products: Card[]; title: string; eyebrow: string; href: string; label: string }) {
  return (
    <section aria-label={title.replace(/\*/g, '')} className="cv-auto container-x py-12">
      <SectionHead eyebrow={eyebrow} title={title} action={{ href, label }} />
      <div className="grid grid-cols-1 gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((p, i) => (
          <div key={p.id} className="focus-rise" style={{ animationDelay: `${(i % 4) * 50}ms` }}>
            <ProductCard product={cardView(p)} />
          </div>
        ))}
      </div>
    </section>
  )
}

export function HowItWorks() {
  const steps = [
    { n: '01', title: 'Alegi rama', text: 'Filtrezi după formă, lățime și material. Dimensiunile reale sunt pe fiecare produs — și le poți compara cu rama ta.', href: '/rame-de-vedere', cta: 'Vezi ramele', glyph: '52□18' },
    { n: '02', title: 'Alegi lentilele', text: 'Monofocale, progresive sau office, cu indicele recomandat pentru rețeta ta și grosimea estimată înainte să plătești.', href: '/lentile', cta: 'Despre lentile', glyph: '1.67' },
    { n: '03', title: 'Trimiți rețeta', text: 'O completezi, încarci o poză sau o trimiți mai târziu. Optometristul o verifică, apoi montăm și livrăm.', href: '/ghid/prescriptie', cta: 'Cum citești rețeta', glyph: 'Rx' },
  ]
  return (
    <section aria-labelledby="cum" className="container-x py-24">
      <SectionHead id="cum" eyebrow="Fără drum la optician" title="Cum comanzi ochelari *de vedere.*" />
      {/* three panels that stack over one another as the page scrolls */}
      <ol className="stack">
        {steps.map((s, i) => (
          <li key={s.n} className="stack-card" style={{ ['--i' as string]: i }}>
            <span className="stack-num">{s.n}</span>
            <div className="stack-body">
              <h3 className="disp text-[clamp(34px,4.4vw,64px)]">{s.title}</h3>
              <p className="mt-4 max-w-md text-[17px] leading-relaxed">{s.text}</p>
              <Link href={s.href} className="stack-cta">
                {s.cta} <Icon name="arrow-right" size={18} />
              </Link>
            </div>
            <span aria-hidden className="stack-glyph">
              {s.glyph}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

const MESH = Array.from({ length: 5 }, (_, k) =>
  Array.from({ length: 14 }, (_, j) => {
    const i = j * 5 + k
    const a = (i / 70) * Math.PI * 2
    const r = 82 + (i % 5) * 9
    const x = 136 + Math.cos(a) * r * 0.78
    const y = 255 + Math.sin(a) * r * 1.12
    return `M${(x - 1.2).toFixed(1)} ${y.toFixed(1)}a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0`
  }).join(''),
)

export function TryOnPromo({ frame }: { frame: Card }) {
  const v = frame.variants[0]!
  return (
    <section aria-labelledby="proba" className="cv-auto container-x py-24">
      <div className="grid items-center gap-14 overflow-clip rounded-[32px] bg-ink px-6 py-14 text-fog sm:px-12 lg:grid-cols-[1fr_420px] lg:py-20">
        <div>
          <div className="eyebrow text-fog/60">Probă virtuală · rulează în browser</div>
          <h2 id="proba" data-split className="disp focus-reveal mt-4 text-[clamp(38px,5.2vw,72px)]">
            Probezi pe fața ta.
            <br />
            <em>La mărimea reală.</em>
          </h2>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-fog/75">
            Camera telefonului găsește 478 de puncte pe față și folosește diametrul irisului ca riglă. Rama apare la dimensiunea ei reală, în milimetri — iar distanța pupilară o măsori pe loc, pentru comandă.
          </p>
          <ol className="b2b-list mt-8 max-w-xl">
            {['Imaginile nu părăsesc telefonul', 'Măsurare PD inclusă', 'Compari două rame alăturat', 'Fără aplicație de instalat'].map((text, i) => (
              <li key={text}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                {text}
              </li>
            ))}
          </ol>
          <Link href="/proba-virtuala" className="btn btn-primary mt-10">
            <Icon name="camera" size={20} /> Pornește proba virtuală
          </Link>
        </div>
        <div aria-hidden className="relative mx-auto h-[560px] w-[290px] rounded-[48px] bg-[#05080A] p-[9px] shadow-[0_50px_90px_-40px_rgba(0,0,0,.7)] ring-1 ring-white/10">
          <div className="relative h-full w-full overflow-hidden rounded-[40px] bg-[#C9D0CC]">
            <div className="absolute inset-0" style={{ background: 'linear-gradient(110deg,#AEB7B2,#E1E6E3 60%)' }} />
            <div className="absolute left-[18%] top-[16%] h-[78%] w-[64%] rounded-[48%_48%_42%_42%] bg-[#8E7B6E] opacity-80 blur-[14px]" />
            {/* face-mesh dots: five staggered groups, one path each */}
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 272 542">
              {MESH.map((d, k) => (
                <path key={k} d={d} fill="#fff" opacity={0.45} style={{ animation: `fadeup 1.2s ${k * 0.22}s infinite alternate` }} />
              ))}
            </svg>
            <div className="absolute left-1/2 top-[38%] w-[86%] -translate-x-1/2 -translate-y-1/2">
              <img src={v.art} alt="" width={Math.round(frame.artBox[0] * 10)} height={Math.round(frame.artBox[1] * 10)} loading="lazy" decoding="async" className="block h-auto w-full drop-shadow-[0_8px_10px_rgba(0,0,0,.25)]" />
            </div>
            <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-white/85 p-3 text-ink backdrop-blur">
              <div className="flex items-center justify-between font-mono text-[11px] tracking-[0.08em]">
                <span>PD MĂSURAT</span>
                <span className="text-cobalt">± 1 mm</span>
              </div>
              <div className="disp text-[30px] tnum">63,5 mm</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function Showroom({ settings }: { settings: StoreSettings }) {
  const c = settings.company
  return (
    <section aria-labelledby="showroom" className="cv-auto container-x py-24">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <div className="eyebrow">Showroom · Galați</div>
          <h2 id="showroom" data-split className="disp focus-reveal mt-3 text-[clamp(34px,4.6vw,60px)]">
            Vino să le vezi
            <br />
            <em>în lumină naturală.</em>
          </h2>
          <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-ink-2">
            Probezi toată colecția, măsurăm PD-ul și înălțimea de montaj, faci consultația optometrică și ridici comanda ajustată pe fața ta.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <OpenNow weekly={settings.hours.weekly} />
          </div>
          <dl className="mt-7 grid max-w-md grid-cols-[auto_1fr] gap-x-10 gap-y-1.5 text-[15px]">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => {
              const d = settings.hours.weekly.find((h) => h.day === day)
              if (!d) return null
              return (
                <div key={day} className="contents">
                  <dt className="text-graphite">{WEEKDAYS_RO[day]}</dt>
                  <dd className="tnum font-mono text-[14px]">{'closed' in d ? 'închis' : `${d.open} – ${d.close}`}</dd>
                </div>
              )
            })}
          </dl>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/programare" className="btn btn-primary">
              <Icon name="calendar" size={20} /> Programează o vizită
            </Link>
            <a href={c.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              <Icon name="pin" size={20} /> Deschide în hartă
            </a>
          </div>
        </div>
        <a href={c.mapsUrl} target="_blank" rel="noopener noreferrer" className="group relative block aspect-[5/4] overflow-hidden rounded-[28px] bg-glass ring-1 ring-line-soft" aria-label={`Hartă: ${c.address}, ${c.city}`}>
          <CityMap />
          <div className="absolute left-[56%] top-[44%] -translate-1/2">
            <div className="lens-ring grid size-28 place-items-center bg-white/40 backdrop-blur-[2px] transition-transform duration-500 group-hover:scale-110">
              <span className="size-2 rounded-full bg-cobalt" />
            </div>
          </div>
          <div className="absolute bottom-5 left-5 rounded-2xl bg-paper/90 px-4 py-3 backdrop-blur">
            <div className="text-[15px] font-bold">{c.address}</div>
            <div className="spec">{c.city} · România</div>
          </div>
        </a>
      </div>
    </section>
  )
}

/** Stylised street map (not a tile map — no third-party requests, no tracking). */
function CityMap() {
  return (
    <svg viewBox="0 0 500 400" className="absolute inset-0 h-full w-full" aria-hidden>
      <rect width="500" height="400" fill="#F3F5F4" />
      <path d="M-20 330 C 90 300, 160 360, 260 330 S 420 290, 520 320 L 520 420 L -20 420 Z" fill="#DDE5EA" />
      <path d="M-20 330 C 90 300, 160 360, 260 330 S 420 290, 520 320" fill="none" stroke="#C8D3DA" strokeWidth="2" />
      <g stroke="#E2E7E4" strokeWidth="10" strokeLinecap="round" fill="none">
        <path d="M40 20 L 120 300" />
        <path d="M200 0 L 230 310" />
        <path d="M360 10 L 330 300" />
        <path d="M-10 90 L 510 70" />
        <path d="M-10 190 L 510 170" />
        <path d="M60 260 L 470 240" />
      </g>
      <g stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M40 20 L 120 300" />
        <path d="M200 0 L 230 310" />
        <path d="M360 10 L 330 300" />
        <path d="M-10 90 L 510 70" />
        <path d="M-10 190 L 510 170" />
        <path d="M60 260 L 470 240" />
        <path d="M120 130 L 420 120" strokeWidth="3" />
        <path d="M280 40 L 290 290" strokeWidth="3" />
      </g>
      <text x="300" y="375" fontFamily="var(--font-code)" fontSize="11" letterSpacing="3" fill="#8A98A3">
        DUNĂREA
      </text>
    </svg>
  )
}

export function B2BBand() {
  const items = ['Prețuri en-gros pe niveluri', 'Stoc în timp real', 'Comandă rapidă pe cod de model', 'Declarații de conformitate']
  return (
    <section aria-labelledby="b2b" data-tone="dark" className="b2b">
      <div aria-hidden className="b2b-word">
        Pentru optici
      </div>
      <div className="container-x grid gap-10 pb-16 lg:grid-cols-[1.3fr_1fr] lg:items-end">
        <div>
          <div className="eyebrow text-white/70">Pentru optici și magazine</div>
          <h2 id="b2b" data-split className="disp mt-4 text-[clamp(34px,4.4vw,58px)]">
            Distribuim ramele SIFRA
            <br />
            <em>în toată România.</em>
          </h2>
        </div>
        <div>
          <ol className="b2b-list">
            {items.map((text, i) => (
              <li key={text}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                {text}
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/b2b" className="btn bg-white text-cobalt hover:bg-fog">
              Cere cont de partener
            </Link>
            <Link href="/b2b/portal" className="btn text-white ring-[1.5px] ring-white/60 ring-inset hover:bg-white/10">
              Am deja cont
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export function JournalTeaser({ posts }: { posts: { slug: string; title: string; excerpt: string | null; category: string | null; readingMinutes: number | null; publishedAt: Date | null }[] }) {
  return (
    <section aria-labelledby="jurnal" className="cv-auto container-x py-24">
      <SectionHead id="jurnal" eyebrow="Jurnal" title="Ghiduri scrise de oameni *care măsoară ochi.*" action={{ href: '/jurnal', label: 'Toate ghidurile' }} />
      <ul className="grid gap-5 md:grid-cols-3">
        {posts.map((p, i) => (
          <li key={p.slug} className="focus-rise">
            <Link href={`/jurnal/${p.slug}`} className="group card flex h-full flex-col overflow-clip no-underline transition-shadow hover:shadow-[var(--shadow-lift)]">
              <div className="relative grid aspect-[16/10] place-items-center overflow-clip bg-[linear-gradient(160deg,#FFFFFF,#E7ECEA)]">
                <span className="chart-row text-[clamp(44px,6vw,84px)] focus-pull text-ink/85">{['Rx', 'A□B', '1.67', 'UV', 'ADD', 'PD'][i % 6]}</span>
                <span className="eyebrow absolute bottom-3 left-4 text-[10.5px]">Fig. {String(i + 1).padStart(2, '0')}</span>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <div className="spec">
                  {p.category} · {p.readingMinutes} min{p.publishedAt ? ` · ${formatDate(p.publishedAt, { day: 'numeric', month: 'short' })}` : ''}
                </div>
                <h3 className="mt-2 text-[20px] font-bold leading-snug">{p.title}</h3>
                <p className="mt-2 line-clamp-3 text-[15px] text-graphite">{p.excerpt}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function FaqList({ faqs, title = 'Întrebări frecvente' }: { faqs: { id: string; question: string; answer: string }[]; title?: string }) {
  return (
    <section aria-labelledby="faq" className="cv-auto container-x py-16">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <div className="eyebrow">Ajutor</div>
          <h2 id="faq" data-split className="disp focus-reveal mt-3 text-[clamp(32px,4vw,52px)]">
            {title}
          </h2>
          <Link href="/contact" className="mt-6 inline-flex items-center gap-2 font-bold text-cobalt no-underline hover:underline">
            Nu găsești răspunsul? Scrie-ne <Icon name="arrow-right" size={16} />
          </Link>
        </div>
        <div className="divide-y divide-line border-y border-line">
          {faqs.map((f) => (
            <details key={f.id} name="faq" className="group py-1">
              <summary className="flex items-center justify-between gap-6 py-4 text-[17px] font-bold">
                {f.question}
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-glass ring-1 ring-line-soft transition-transform duration-300 group-open:rotate-45">
                  <Icon name="plus" size={16} />
                </span>
              </summary>
              <p className="pb-5 pr-12 text-[16px] leading-relaxed text-ink-2">{f.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
