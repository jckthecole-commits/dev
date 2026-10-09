import Link from 'next/link'
import { Wordmark } from '@/components/brand'
import { Icon } from '@/components/icons'
import { WEEKDAYS_RO } from '@/lib/settings-schema'
import { getSettings } from '@/server/settings'
import { CookiePrefsLink } from './consent'
import { NewsletterForm } from './newsletter-form'

const COLS: { title: string; links: [string, string][] }[] = [
  {
    title: 'Cumpără',
    links: [
      ['/rame-de-vedere', 'Rame de vedere'],
      ['/ochelari-de-soare', 'Ochelari de soare'],
      ['/lentile', 'Lentile & tratamente'],
      ['/proba-virtuala', 'Probă virtuală'],
      ['/rame-de-vedere?pentru=copii', 'Rame pentru copii'],
    ],
  },
  {
    title: 'Ajutor',
    links: [
      ['/livrare-si-plata', 'Livrare și plată'],
      ['/retur-si-garantie', 'Retur și garanție'],
      ['/ghid/prescriptie', 'Cum citești prescripția'],
      ['/ghid/marimea-ramei', 'Ghid mărimi rame'],
      ['/intrebari-frecvente', 'Întrebări frecvente'],
      ['/contact', 'Contact'],
    ],
  },
  {
    title: 'Sifra Vision',
    links: [
      ['/showroom-galati', 'Showroom Galați'],
      ['/programare', 'Programare consultație'],
      ['/conformitate', 'Conformitate & siguranță'],
      ['/b2b', 'Pentru optici (B2B)'],
      ['/jurnal', 'Jurnal & ghiduri'],
    ],
  },
  {
    title: 'Legal',
    links: [
      ['/termeni-si-conditii', 'Termeni și condiții'],
      ['/politica-de-confidentialitate', 'Confidențialitate'],
      ['/politica-cookies', 'Politica de cookies'],
      ['/accesibilitate', 'Accesibilitate'],
    ],
  },
]

export async function SiteFooter() {
  const s = await getSettings()
  const c = s.company
  const hours = s.hours.weekly
  const fmt = (d: (typeof hours)[number]) => ('closed' in d ? 'închis' : `${d.open}–${d.close}`)
  return (
    <footer data-tone="dark" className="cv-auto relative mt-24 overflow-hidden bg-ink text-fog">
      <div className="container-x relative pb-10 pt-16">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_2fr]">
          <div className="flex flex-col gap-6">
            <Wordmark size={24} inverted />
            <p className="max-w-sm text-[15px] leading-relaxed text-fog/70">Optică cu laborator propriu în Galați. Rame alese cu grijă, lentile verificate de optometrist, livrare în toată România.</p>
            <div className="flex flex-col gap-1.5 text-[15px]">
              <span className="flex items-start gap-2.5">
                <Icon name="pin" size={18} className="mt-0.5 shrink-0 text-fog/60" />
                {c.address}, {c.city}
              </span>
              {c.phone ? (
                <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="flex items-center gap-2.5 no-underline hover:underline">
                  <Icon name="phone" size={18} className="text-fog/60" />
                  {c.phone}
                </a>
              ) : null}
              <a href={`mailto:${c.email}`} className="flex items-center gap-2.5 no-underline hover:underline">
                <Icon name="mail" size={18} className="text-fog/60" />
                {c.email}
              </a>
            </div>
            <dl className="grid max-w-xs grid-cols-[auto_1fr] gap-x-6 gap-y-1 font-mono text-[12.5px] text-fog/70">
              {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                const d = hours.find((h) => h.day === day)
                return d ? (
                  <div key={day} className="contents">
                    <dt>{WEEKDAYS_RO[day]}</dt>
                    <dd className="tnum text-right">{fmt(d)}</dd>
                  </div>
                ) : null
              })}
            </dl>
          </div>

          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {COLS.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <h2 className="eyebrow mb-4 text-fog/55">{col.title}</h2>
                <ul className="flex flex-col gap-2.5">
                  {col.links.map(([href, label]) => (
                    <li key={href}>
                      <Link href={href} className="text-[15px] text-fog/90 no-underline hover:text-white hover:underline">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-14 grid gap-8 border-t border-white/10 pt-10 lg:grid-cols-[1.1fr_2fr] lg:items-end">
          <div>
            <h2 className="disp text-[28px]">Ce mai e nou, o dată pe lună.</h2>
            <p className="mt-2 text-[15px] text-fog/65">Colecții noi și ghiduri despre vedere. Fără spam.</p>
          </div>
          <NewsletterForm />
        </div>

        <div className="mt-12 flex flex-col gap-6 border-t border-white/10 pt-8 text-[12.5px] text-fog/55 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1 font-mono">
            <span>
              © {c.legalName}
              {c.cui ? ` · CUI ${c.cui}` : ''}
              {c.regCom ? ` · ${c.regCom}` : ''}
            </span>
            {c.medicalNotice ? <span>{c.medicalNotice}</span> : <span>Rame și lentile corective: dispozitive medicale clasa I (Reg. UE 2017/745).</span>}
            <CookiePrefsLink />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* ANPC — Soluționarea Alternativă a Litigiilor (Ord. ANPC 270/2026). Replace with the official 250×50 pictogram. */}
            <a href="https://reclamatiisal.anpc.ro" target="_blank" rel="noopener noreferrer" className="flex h-[50px] w-[250px] items-center gap-3 rounded-md bg-white px-3 text-ink no-underline" aria-label="ANPC — Soluționarea alternativă a litigiilor">
              <span className="font-display text-[15px] font-extrabold tracking-wide">ANPC</span>
              <span className="text-[10.5px] font-bold leading-tight">SOLUȚIONAREA ALTERNATIVĂ
                <br />A LITIGIILOR</span>
            </a>
            <span className="flex items-center gap-2 rounded-md border border-white/15 px-3 py-2 font-mono text-[11px] text-fog/70">
              <Icon name="lock" size={14} /> Plăți securizate 3-D Secure
            </span>
          </div>
        </div>
      </div>
      {/* giant wordmark: once the motion layer is up, letters gain weight and width near the cursor */}
      <div aria-hidden data-kinetic className="footer-kinetic">
        SIFRA VISION
      </div>
    </footer>
  )
}
