import Link from 'next/link'
import { Icon } from '@/components/icons'
import { ProductCard } from '@/components/shop/product-card'
import { cardView, type ProductCard as Card } from '@/lib/catalog-query'
import { rich } from './sections'

/** The brand's lens mark, used as the separator in the marquee. */
function LensMark() {
  return (
    <svg viewBox="0 0 20 20" className="mq-lens" aria-hidden>
      <circle cx="10" cy="10" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.5 7.2 A5.5 5.5 0 0 1 9 4.6" fill="none" stroke="#2638C9" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/**
 * A band of giant words that loops on its own (CSS); once the motion layer is up,
 * scrolling speeds it up, reverses it when scrolling back, and leans it into the move.
 */
export function Marquee({ items }: { items: string[] }) {
  const row = (
    <span className="mq-row">
      {items.map((t, i) => (
        <span key={t} className="mq-item">
          <span className={i % 2 ? 'mq-outline' : 'mq-solid'}>{t}</span>
          <LensMark />
        </span>
      ))}
    </span>
  )
  return (
    <section aria-hidden className="marquee" data-marquee>
      <div className="mq-skew">
        <div className="mq-track" data-marquee-track>
          {row}
          {row}
        </div>
      </div>
    </section>
  )
}

/** One paragraph, read at the reader's pace: words come into focus as it is scrolled through. */
export function Manifesto() {
  return (
    <section aria-labelledby="manifest" className="cv-auto container-x py-28 lg:py-40">
      <div className="eyebrow mb-8" id="manifest">
        Manifest
      </div>
      <p data-scrub-words className="manifesto">
        Vedem ochelarii ca pe un <em>instrument.</em> Fiecare ramă are cotele ei reale, în milimetri. O probezi pe fața ta din telefon, iar grosimea lentilei o calculăm înainte să plătești. <em>Restul e stil.</em>
      </p>
    </section>
  )
}

/**
 * The collection as a gallery that slides sideways while the page scrolls (desktop, CSS
 * scroll-driven — no JS), and a swipeable strip on phones.
 */
export function CollectionRail({ products, title, eyebrow, href, label }: { products: Card[]; title: string; eyebrow: string; href: string; label: string }) {
  return (
    <section aria-label={title.replace(/\*/g, '')} className="rail" style={{ ['--n' as string]: products.length }}>
      <div className="rail-sticky">
        <div className="container-x mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between lg:mb-10">
          <div className="max-w-3xl">
            <div className="eyebrow mb-3">
              {eyebrow} · {String(products.length).padStart(2, '0')} modele
            </div>
            <h2 data-split className="disp focus-reveal text-[clamp(34px,4.6vw,60px)]">
              {rich(title)}
            </h2>
          </div>
          <Link href={href} className="group inline-flex shrink-0 items-center gap-2 font-bold text-ink no-underline">
            <span className="nl">{label}</span>
            <Icon name="arrow-right" size={18} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
        <div className="rail-viewport">
          <ul className="rail-track">
            {products.map((p, i) => (
              <li key={p.id} className="rail-card">
                <span aria-hidden className="rail-index">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <ProductCard product={cardView(p)} />
              </li>
            ))}
          </ul>
        </div>
        <div aria-hidden className="rail-progress container-x">
          <span />
        </div>
      </div>
    </section>
  )
}
