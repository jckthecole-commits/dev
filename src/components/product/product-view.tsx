'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useSyncExternalStore, useTransition, ViewTransition } from 'react'
import { addToCart } from '@/app/actions/cart'
import { FrameArt, type FrameArtProduct } from '@/components/frame-art'
import { Icon } from '@/components/icons'
import { FavoriteButton } from '@/components/shop/favorite-button'
import { cn } from '@/lib/cn'
import type { Swatch } from '@/lib/db/schema'
import { formatFrameSize, formatPrice } from '@/lib/format'
import { flyToCart } from '@/lib/fly-to-cart'
import { onFirstInteraction } from '@/lib/interaction'
import type { FrameSpec } from '@/lib/frame-geometry'
import { swatchCss } from '@/lib/product-art'
import { noSubscribe, webglServerSnapshot, webglSnapshot } from '@/lib/webgl'
import type { ViewerEngine } from '@/components/three/viewer-engine'

export type PdpVariant = { id: string; sku: string; colorName: string; colorSlug: string; swatch: Swatch; priceDelta: number; stock: { showroom: number; warehouse: number } }
export type PdpProduct = {
  id: string
  slug: string
  name: string
  family: string
  category: 'optical' | 'sun'
  tagline: string | null
  badge: string | null
  price: number
  compareAtPrice: number | null
  lensWidth: number
  bridgeWidth: number
  templeLength: number
  lensHeight: number
  frameWidth: number
  weightGrams: number | null
  material: string
  filterCategory: number | null
  polarized: boolean
  art: FrameArtProduct
  /** Hinge knuckles when the product states them — modelled in the 3D view. */
  knuckles: number | null
  images: { key: string; alt: string; variantId: string | null }[]
  variants: PdpVariant[]
  sizes: { slug: string; name: string; lensWidth: number; bridgeWidth: number; templeLength: number }[]
}

export function ProductViewWithParams(props: { product: PdpProduct; productionDays: string }) {
  const sp = useSearchParams()
  return <ProductView {...props} initialColor={sp.get('culoare')} />
}

export function ProductView({ product: p, initialColor, productionDays }: { product: PdpProduct; initialColor?: string | null; productionDays: string }) {
  const [vid, setVid] = useState(() => (p.variants.find((v) => v.colorSlug === initialColor) ?? p.variants[0]!).id)
  const v = p.variants.find((x) => x.id === vid) ?? p.variants[0]!
  const [view, setView] = useState<'3d' | 'front' | 'photo' | null>(null)
  const galleryRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<ViewerEngine | null>(null)
  const swatchRef = useRef(v.swatch)
  const canGl = useSyncExternalStore(noSubscribe, webglSnapshot, webglServerSnapshot)
  const [gl, setGl] = useState(false)
  const [spun, setSpun] = useState(false)
  const [folded, setFolded] = useState(false)
  // the 3D view takes over once it's ready, unless a view was picked by hand
  const shown = view ?? (gl ? '3d' : 'front')
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const photos = p.images.filter((i) => !i.variantId || i.variantId === v.id)
  const price = p.price + v.priceDelta
  const total = v.stock.showroom + v.stock.warehouse

  useEffect(() => {
    swatchRef.current = v.swatch
    engineRef.current?.setSwatch(v.swatch)
  }, [v.swatch])
  useEffect(() => {
    engineRef.current?.setFolded(folded)
  }, [folded])

  // 360° viewer: three.js loads once the gallery is on screen and the page is idle
  useEffect(() => {
    if (!canGl) return
    let engine: ViewerEngine | null = null
    let cancelled = false
    const io = new IntersectionObserver(([en]) => {
      if (!en?.isIntersecting) return
      io.disconnect()
      const go = async () => {
        try {
          const { startViewerEngine } = await import('@/components/three/viewer-engine')
          if (cancelled || !canvasRef.current) return
          engine = await startViewerEngine({
            canvas: canvasRef.current,
            spec: p.art as FrameSpec,
            swatch: swatchRef.current,
            templeLength: p.templeLength,
            knuckles: p.knuckles ?? undefined,
            onReady: () => setGl(true),
            onInteract: () => setSpun(true),
          })
          if (cancelled) engine.dispose()
          else engineRef.current = engine
        } catch {
          // no WebGL after all — the drawn front view stays
        }
      }
      // …and only after the visitor's first move, so the first load stays light
      stopWaiting = onFirstInteraction(() => {
        if ('requestIdleCallback' in window) window.requestIdleCallback(() => void go(), { timeout: 800 })
        else setTimeout(() => void go(), 50)
      })
    })
    let stopWaiting = () => {}
    io.observe(galleryRef.current!)
    return () => {
      cancelled = true
      stopWaiting()
      io.disconnect()
      engine?.dispose()
      engineRef.current = null
    }
  }, [canGl, p.art, p.templeLength, p.knuckles])

  const choose = (id: string) => {
    setVid(id)
    const next = p.variants.find((x) => x.id === id)
    if (next) window.history.replaceState(null, '', `?culoare=${next.colorSlug}`)
  }

  const addFrameOnly = () =>
    start(async () => {
      const fd = new FormData()
      fd.set('variantId', v.id)
      fd.set('config', JSON.stringify({ lensType: 'none', treatments: [] }))
      const r = await addToCart(fd)
      if (r.ok) flyToCart(galleryRef.current?.querySelector('[data-fly]'))
      setMsg(r.ok ? { ok: true, text: 'Adăugat în coș.' } : { ok: false, text: r.error })
    })

  return (
    <div className="grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:gap-14">
      {/* gallery */}
      <div className="lg:sticky lg:top-[calc(var(--header-h)+16px)] lg:self-start">
        <div ref={galleryRef} className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-glass ring-1 ring-line-soft ring-inset">
          {shown === 'photo' && photos[0] ? (
            <img src={`/media/${photos[0].key.replace(/^public\//, '')}`} alt={photos[0].alt || p.name} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className={cn('absolute inset-0 grid place-items-center transition-opacity duration-700', shown === '3d' && 'opacity-0')}>
              <ViewTransition name={`frame-${p.slug}`}>
                <div data-fly className="w-[84%]">
                  <FrameArt product={p.art} swatch={v.swatch} shadow className="h-auto w-full" title={`${p.name}, ${v.colorName}, vedere din față`} />
                </div>
              </ViewTransition>
            </div>
          )}
          {canGl ? (
            <canvas
              ref={canvasRef}
              tabIndex={shown === '3d' ? 0 : -1}
              aria-hidden={shown !== '3d'}
              aria-label={`${p.name}, ${v.colorName}, în 3D. Trage sau folosește săgețile ca s-o rotești; dublu clic o readuce din față.`}
              className={cn('absolute inset-0 h-full w-full cursor-grab touch-pan-y outline-none transition-opacity duration-700 focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-inset active:cursor-grabbing', shown === '3d' ? 'opacity-100' : 'pointer-events-none opacity-0')}
            />
          ) : null}
          <div className="pointer-events-none absolute left-4 top-4 flex gap-2">
            {p.badge ? <span className="rounded-full bg-paper px-3 py-1 font-mono text-[11px] uppercase tracking-[0.1em] ring-1 ring-line-soft">{p.badge}</span> : null}
            <span className={cn('rounded-full bg-paper/80 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-graphite backdrop-blur', shown === '3d' && 'max-sm:hidden')}>{shown === '3d' ? '3D · la scară' : 'randare la scară'}</span>
          </div>
          {shown === '3d' ? (
            <div className="absolute right-4 top-4 flex items-center gap-3">
              <span aria-hidden className={cn('hidden font-mono text-[11px] uppercase tracking-[0.14em] text-graphite transition-opacity duration-700 sm:inline', spun && 'opacity-0')}>
                <span className="inline-block animate-[nudge_1.6s_var(--ease-in-out-soft)_infinite]">↔</span> Trage ca s-o rotești
              </span>
              <button type="button" onClick={() => setFolded((f) => !f)} aria-pressed={folded} className="rounded-full bg-paper/85 px-3.5 py-1.5 text-[13px] font-bold ring-1 ring-line backdrop-blur hover:ring-ink">
                {folded ? 'Deschide brațele' : 'Pliază brațele'}
              </button>
            </div>
          ) : null}
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2">
            <div className="flex gap-2">
              {gl ? (
                <button type="button" onClick={() => setView('3d')} aria-pressed={shown === '3d'} className={cn('rounded-full px-3.5 py-1.5 text-[13px] font-bold ring-1', shown === '3d' ? 'bg-ink text-fog ring-ink' : 'bg-paper ring-line')}>
                  3D
                </button>
              ) : null}
              <button type="button" onClick={() => setView('front')} aria-pressed={shown === 'front'} className={cn('rounded-full px-3.5 py-1.5 text-[13px] font-bold ring-1', shown === 'front' ? 'bg-ink text-fog ring-ink' : 'bg-paper ring-line')}>
                Față
              </button>
              {photos.length ? (
                <button type="button" onClick={() => setView('photo')} aria-pressed={shown === 'photo'} className={cn('rounded-full px-3.5 py-1.5 text-[13px] font-bold ring-1', shown === 'photo' ? 'bg-ink text-fog ring-ink' : 'bg-paper ring-line')}>
                  Foto
                </button>
              ) : null}
            </div>
            <Link href={`/proba-virtuala?rama=${p.slug}&culoare=${v.colorSlug}`} className="inline-flex items-center gap-2 rounded-full bg-paper px-4 py-2 text-[13.5px] font-bold no-underline ring-1 ring-line hover:ring-ink">
              <Icon name="camera" size={18} /> Probează pe fața ta
            </Link>
          </div>
        </div>
      </div>

      {/* info */}
      <div className="flex flex-col">
        <div className="eyebrow">{p.category === 'sun' ? 'Ochelari de soare' : 'Rame de vedere'} · SIFRA</div>
        <h1 className="disp mt-3 text-[clamp(44px,5.4vw,76px)]">{p.name}</h1>
        {p.tagline ? <p className="mt-3 text-[18px] text-ink-2">{p.tagline}</p> : null}
        <div className="mt-5 flex items-baseline gap-3">
          <span className="disp text-[34px] tnum">{formatPrice(price)}</span>
          {p.compareAtPrice ? <span className="text-[17px] text-mist line-through tnum">{formatPrice(p.compareAtPrice)}</span> : null}
          <span className="text-[14px] text-graphite">{p.category === 'sun' ? 'cu lentile de soare incluse' : 'rama · lentilele le alegi în pasul următor'}</span>
        </div>

        <div className="mt-8">
          <div className="flex items-baseline justify-between">
            <span className="text-[14px] font-bold">Culoare</span>
            <span className="text-[14px] text-graphite">{v.colorName}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Culoare">
            {p.variants.map((x) => (
              <button
                key={x.id}
                type="button"
                role="radio"
                aria-checked={x.id === v.id}
                aria-label={x.colorName}
                onClick={() => choose(x.id)}
                className={cn('flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 text-[14px] ring-1 transition-shadow', x.id === v.id ? 'bg-paper ring-[1.5px] ring-ink' : 'ring-line hover:ring-graphite')}
              >
                <span className="size-7 rounded-full ring-1 ring-black/10" style={{ background: swatchCss(x.swatch) }} />
                {x.colorName}
              </button>
            ))}
          </div>
        </div>

        {p.sizes.length > 1 ? (
          <div className="mt-6">
            <div className="text-[14px] font-bold">Mărime</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {p.sizes.map((s) => (
                <Link key={s.slug} href={`/rame/${s.slug}`} aria-current={s.slug === p.slug ? 'page' : undefined} className={cn('rounded-xl px-4 py-2 font-mono text-[13.5px] no-underline ring-1', s.slug === p.slug ? 'bg-ink text-fog ring-ink' : 'ring-line hover:ring-ink')}>
                  {formatFrameSize(s)}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-line-soft ring-1 ring-line-soft sm:grid-cols-4">
          {[
            ['Lentilă', `${p.lensWidth} mm`],
            ['Punte', `${p.bridgeWidth} mm`],
            ['Braț', `${p.templeLength} mm`],
            ['Înălțime', `${p.lensHeight} mm`],
            ['Lățime totală', `${p.frameWidth} mm`],
            ['Greutate', p.weightGrams ? `${p.weightGrams} g` : '—'],
            ...(p.category === 'sun' ? [['Filtru', `cat. ${p.filterCategory ?? 3} · UV400`], ['Polarizat', p.polarized ? 'da' : 'nu']] : [['Material', p.material], ['Progresive', p.lensHeight >= 28 ? 'compatibilă' : 'nu']]),
          ].map(([k, val]) => (
            <div key={k} className="bg-glass px-4 py-3">
              <dt className="spec">{k}</dt>
              <dd className="mt-0.5 text-[15px] font-bold tnum">{val}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 flex flex-col gap-3">
          <Link data-magnetic href={`/configurator/${p.slug}?culoare=${v.colorSlug}`} className="btn btn-primary btn-lg w-full">
            {p.category === 'sun' ? 'Vreau cu dioptrii' : 'Alege lentilele'} <Icon name="arrow-right" size={20} />
          </Link>
          <div className="flex gap-3">
            <button type="button" onClick={addFrameOnly} disabled={pending || total <= 0} className="btn btn-secondary flex-1">
              {pending ? 'Se adaugă…' : p.category === 'sun' ? 'Adaugă în coș' : 'Doar rama'}
            </button>
            <FavoriteButton slug={p.slug} name={p.name} className="size-[52px] ring-[1.5px] ring-ink" />
          </div>
          {msg ? (
            <p role="status" className={cn('flex items-center gap-2 text-[14px]', msg.ok ? 'text-ok' : 'text-err')}>
              <Icon name={msg.ok ? 'check' : 'alert'} size={18} />
              {msg.text}
              {msg.ok ? (
                <Link href="/cos" className="ml-auto font-bold text-cobalt">
                  Vezi coșul →
                </Link>
              ) : null}
            </p>
          ) : null}
        </div>

        <ul className="mt-8 flex flex-col gap-3 border-t border-line pt-6 text-[14.5px]">
          <li className="flex items-start gap-3">
            <Icon name="store" size={20} className="mt-0.5 shrink-0" />
            {v.stock.showroom > 0 ? (
              <span>
                <strong>În stoc în showroom-ul din Galați</strong> — o poți proba azi.
              </span>
            ) : total > 0 ? (
              <span>
                <strong>În stoc în depozit</strong> — o aducem în showroom în 24 h la cerere.
              </span>
            ) : (
              <span>
                <strong>La comandă</strong> — disponibilă în 7–10 zile lucrătoare.
              </span>
            )}
          </li>
          <li className="flex items-start gap-3">
            <Icon name="truck" size={20} className="mt-0.5 shrink-0" />
            <span>{p.category === 'sun' ? 'Livrare în 1–2 zile lucrătoare.' : `Cu lentile: gata în ${productionDays} zile lucrătoare, apoi 1–2 zile livrare.`}</span>
          </li>
          <li className="flex items-start gap-3">
            <Icon name="eye" size={20} className="mt-0.5 shrink-0" />
            <span>Rețeta e verificată de optometrist înainte de montaj.</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
