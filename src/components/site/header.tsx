import Link from 'next/link'
import { Suspense } from 'react'
import { Wordmark } from '@/components/brand'
import { FrameArt } from '@/components/frame-art'
import { Icon } from '@/components/icons'
import { SHAPES } from '@/lib/catalog-filters'
import type { Shape } from '@/lib/frame-geometry'
import { getSettings } from '@/server/settings'
import { CartCount } from './cart-count'
import { MobileMenu } from './mobile-menu'
import { SearchButton } from './search'

export const SHAPE_ICON_SPEC = (shape: Shape) =>
  ({
    shape,
    lensWidth: 50,
    lensHeight: shape === 'round' ? 46 : shape === 'square' || shape === 'geometric' || shape === 'pilot' ? 44 : 38,
    bridgeWidth: 18,
    rim: shape === 'browline' ? ('full' as const) : ('full' as const),
    material: 'acetat' as const,
    geometry: { rim: 3.2, bridgeStyle: 'keyhole' as const, browWeight: 1.7 },
  }) as const

const NAV = [
  { href: '/rame-de-vedere', label: 'Rame de vedere', mega: true },
  { href: '/ochelari-de-soare', label: 'Ochelari de soare' },
  { href: '/proba-virtuala', label: 'Probă virtuală' },
  { href: '/lentile', label: 'Lentile' },
  { href: '/showroom-galati', label: 'Magazinul' },
]

export async function SiteHeader({ overlay = true }: { overlay?: boolean }) {
  const settings = await getSettings()
  const ann = settings.announcement
  return (
    <>
      {ann.enabled ? (
        <div className="relative z-40 bg-ink text-fog">
          <div className="container-x flex h-9 items-center justify-center gap-3 text-center font-mono text-[11.5px] tracking-[0.06em]">
            <Link href={ann.href || '/'} className="truncate no-underline hover:underline">
              {ann.text}
            </Link>
          </div>
        </div>
      ) : null}
      <header
        data-overlay={overlay || undefined}
        className="header-glass sticky top-0 z-30 h-[var(--header-h)] bg-fog/85 backdrop-blur-md data-[overlay]:bg-transparent data-[overlay]:backdrop-blur-none"
      >
        <div className="container-x flex h-full items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <MobileMenu nav={NAV} />
            <Wordmark size={20} className="text-ink" />
          </div>

          <nav aria-label="Principal" className="hidden items-center gap-8 lg:flex">
            {NAV.map((item) =>
              item.mega ? (
                <div key={item.href} className="group relative">
                  <Link href={item.href} className="nl py-3 text-[15px] font-medium text-ink">
                    {item.label}
                  </Link>
                  <MegaMenu />
                </div>
              ) : (
                <Link key={item.href} href={item.href} className="nl py-3 text-[15px] font-medium text-ink">
                  {item.label}
                </Link>
              ),
            )}
          </nav>

          <div className="flex items-center gap-0.5">
            <SearchButton />
            <Link href="/favorite" aria-label="Favorite" className="hidden size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/[.07] sm:inline-flex">
              <Icon name="heart" />
            </Link>
            <Link href="/cont" aria-label="Contul meu" className="hidden size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/[.07] sm:inline-flex">
              <Icon name="user" />
            </Link>
            <Suspense
              fallback={
                <Link href="/cos" aria-label="Coș" className="inline-flex size-11 items-center justify-center rounded-full text-ink">
                  <Icon name="bag" />
                </Link>
              }
            >
              <CartCount />
            </Suspense>
            <Link href="/programare" className="btn btn-secondary btn-sm ml-3 hidden xl:inline-flex">
              Programează-te
            </Link>
          </div>
        </div>
      </header>
    </>
  )
}

function MegaMenu() {
  return (
    <div className="invisible absolute left-1/2 top-full z-40 w-[760px] -translate-x-1/2 translate-y-2 pt-4 opacity-0 transition-all duration-200 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
      <div className="card grid grid-cols-[1.5fr_1fr] gap-8 bg-glass p-7 shadow-[var(--shadow-lift)]">
        <div>
          <div className="eyebrow mb-4">Caută după formă</div>
          <ul className="grid grid-cols-4 gap-2">
            {SHAPES.map((s) => (
              <li key={s.value}>
                <Link
                  href={`/rame-de-vedere?forma=${s.slug}`}
                  className="group/s flex flex-col items-center gap-2 rounded-xl px-2 py-3 text-center text-[13px] font-medium no-underline transition-colors hover:bg-fog"
                >
                  <FrameArt product={SHAPE_ICON_SPEC(s.value)} swatch={{ kind: 'solid', primary: '#0D1216' }} mode="rim" rimColor="#0D1216" className="h-7 w-auto transition-transform duration-300 group-hover/s:scale-110" />
                  {s.plural}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-1 border-l border-line pl-8">
          <div className="eyebrow mb-3">Colecție</div>
          {[
            ['/rame-de-vedere?pentru=femei', 'Pentru femei'],
            ['/rame-de-vedere?pentru=barbati', 'Pentru bărbați'],
            ['/rame-de-vedere?pentru=copii', 'Pentru copii'],
            ['/rame-de-vedere?material=titan', 'Titan, ultra-ușoare'],
            ['/rame-de-vedere?caracteristici=progresive', 'Potrivite pentru progresive'],
            ['/rame-de-vedere?ordonare=noi', 'Noutăți'],
          ].map(([href, label]) => (
            <Link key={href} href={href!} className="group/l flex items-center justify-between rounded-lg py-1.5 text-[15px] no-underline hover:text-cobalt">
              {label}
              <Icon name="arrow-right" size={16} className="-translate-x-1 opacity-0 transition-all group-hover/l:translate-x-0 group-hover/l:opacity-100" />
            </Link>
          ))}
          <Link href="/ghid/marimea-ramei" className="mt-4 flex items-center gap-2 text-[13px] text-graphite no-underline hover:text-ink">
            <Icon name="ruler" size={18} /> Cum aleg mărimea ramei?
          </Link>
        </div>
      </div>
    </div>
  )
}
