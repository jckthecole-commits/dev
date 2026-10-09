'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { FrameArt, type FrameArtProduct } from '@/components/frame-art'
import { Icon } from '@/components/icons'
import { cn } from '@/lib/cn'
import type { Swatch } from '@/lib/db/schema'
import { frameLayout, type FrameSpec } from '@/lib/frame-geometry'
import { swatchCss } from '@/lib/product-art'
import { onFirstInteraction } from '@/lib/interaction'
import { largest, srcSet, type MediaImage } from '@/lib/media'
import type { HeroEngine } from '@/components/three/hero-engine'

export type HeroFrame = {
  slug: string
  name: string
  kind: string
  spec: string
  price: string
  art: FrameArtProduct
  templeLength: number
  variants: { name: string; swatch: Swatch }[]
}

const CHART: [string, number][] = [
  ['S', 150],
  ['IF', 108],
  ['RAV', 82],
  ['ISIO', 62],
  ['NGAL', 46],
  ['AȚI', 34],
  ['188', 24],
]

function EyeChart({ scale = 1 }: { scale?: number }) {
  return (
    <>
      {CHART.map(([t, size]) => (
        <span key={t} className="chart-row" style={{ fontSize: size * scale }}>
          {t}
        </span>
      ))}
      <span className="chart-row mt-2.5 font-mono font-normal" style={{ fontSize: 12 * Math.max(scale, 0.85), letterSpacing: '.4em' }}>
        STR. ALEXANDRU CERNAT
      </span>
    </>
  )
}

/** Each word: an upright Mona Sans part and an italic Bodoni accent where marked with *…*. */
const TITLE = ['Când stilul', '*ține pasul*', 'cu tine.']

function KineticTitle({ className }: { className?: string }) {
  let i = 0
  return (
    <h1 className={className} aria-label={TITLE.join(' ').replace(/\*/g, '')}>
      {TITLE.map((raw) => {
        const accent = raw.startsWith('*')
        const line = raw.replace(/\*/g, '')
        return (
          <span key={line} aria-hidden="true" className={cn('block whitespace-nowrap', accent && 'hero-accent')}>
            {line.split(' ').map((w) => (
              <span key={w} className="mr-[0.22em] inline-block whitespace-nowrap">
                {Array.from(w).map((ch) => {
                  const d = (i++ * 0.032).toFixed(3)
                  return (
                    <span key={`${ch}${d}`} className="ltr" style={{ animationDelay: `calc(var(--intro-delay) + ${d}s)` }}>
                      {ch}
                    </span>
                  )
                })}
              </span>
            ))}
          </span>
        )
      })}
    </h1>
  )
}

/** CSS 3D fallback: stacked silhouettes give real thickness; temples fold back. */
function Frame3D({ art, swatch, widthPx }: { art: FrameArtProduct; swatch: Swatch; widthPx: number }) {
  const L = frameLayout(art as FrameSpec)
  const [, vy, vw, vh] = L.viewBox
  const k = widthPx / vw
  const heightPx = vh * k
  const hingeTop = (L.hingeY - vy) * k
  const hingeInset = (vw / 2 - L.hingeX) * k
  const templeLen = 82 * k
  const templeH = Math.max(4, L.rimW * k * 0.9)
  const metal = art.material === 'metal' || art.material === 'titan'
  const templeBg = metal ? 'linear-gradient(#C9CED2,#6B737A)' : 'linear-gradient(#3A434B,#1B2025)'
  return (
    <div className="frame3d relative" style={{ width: widthPx, height: heightPx, transformStyle: 'preserve-3d' }}>
      {[-7, -4.5, -2].map((z, idx) => (
        <div key={z} className="absolute inset-0" style={{ transform: `translateZ(${z}px)` }}>
          <FrameArt product={art} swatch={swatch} mode="rim" rimColor={['#07090B', '#0E1215', '#161B20'][idx]} className="h-full w-full" idSalt={`z${z}`} />
        </div>
      ))}
      <div className="absolute inset-0">
        <FrameArt product={art} swatch={swatch} className="h-full w-full" temples={false} />
      </div>
      <div className="absolute rounded-md" style={{ left: hingeInset - 2, top: hingeTop - templeH / 2, width: templeLen, height: templeH, background: templeBg, transformOrigin: 'left center', transform: 'rotateY(96deg)' }} />
      <div className="absolute rounded-md" style={{ right: hingeInset - 2, top: hingeTop - templeH / 2, width: templeLen, height: templeH, background: templeBg, transformOrigin: 'right center', transform: 'rotateY(-96deg)' }} />
    </div>
  )
}

function Controls({ frames, fi, vi, onFrame, onVariant, className }: { frames: HeroFrame[]; fi: number; vi: number; onFrame: (i: number) => void; onVariant: (i: number) => void; className?: string }) {
  const f = frames[fi]!
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div role="radiogroup" aria-label={`Culori ${f.name}`} className="flex items-center gap-1.5">
        {f.variants.map((v, i) => (
          <button
            key={v.name}
            type="button"
            role="radio"
            aria-checked={i === vi}
            aria-label={v.name}
            title={v.name}
            onClick={() => onVariant(i)}
            className={cn('grid size-8 place-items-center rounded-full transition-[box-shadow,transform] active:scale-90', i === vi ? 'ring-[1.5px] ring-ink' : 'ring-1 ring-transparent hover:ring-line')}
          >
            <span className="size-[18px] rounded-full ring-1 ring-black/10" style={{ background: swatchCss(v.swatch) }} />
          </button>
        ))}
      </div>
      <span className="h-5 w-px bg-line" />
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Rama anterioară" onClick={() => onFrame((fi - 1 + frames.length) % frames.length)} className="grid size-9 place-items-center rounded-full ring-1 ring-line transition hover:bg-ink hover:text-fog active:scale-90">
          <Icon name="chevron-left" size={18} />
        </button>
        <span className="w-12 text-center font-mono text-[12px] tnum" aria-live="polite">
          {String(fi + 1).padStart(2, '0')}/{String(frames.length).padStart(2, '0')}
        </span>
        <button type="button" aria-label="Rama următoare" onClick={() => onFrame((fi + 1) % frames.length)} className="grid size-9 place-items-center rounded-full ring-1 ring-line transition hover:bg-ink hover:text-fog active:scale-90">
          <Icon name="chevron-right" size={18} />
        </button>
      </div>
    </div>
  )
}

function Hint({ show, touch }: { show: boolean; touch?: boolean }) {
  return (
    <p aria-hidden className={cn('m-0 flex items-center gap-2 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.14em] text-graphite transition-opacity duration-700', show ? 'opacity-100' : 'opacity-0')}>
      <span className="inline-block animate-[nudge_1.6s_var(--ease-in-out-soft)_infinite]">↔</span>
      {touch ? 'Glisează pe ramă ca s-o rotești' : 'Trage de ramă ca s-o rotești'}
    </p>
  )
}

/** Portrait screens get the vertical photograph; the engine and the CSS agree on this query. */
const PORTRAIT = '(max-aspect-ratio: 4/5)'

/** The Danube at Galați in fog: blurred behind everything, sharp only through the lenses. */
function Photo({ photo, sharp, imgRef }: { photo: { wide: MediaImage; tall: MediaImage }; sharp: boolean; imgRef?: React.Ref<HTMLImageElement> }) {
  const { wide, tall } = photo
  if (!sharp)
    return (
      <picture>
        <source media={PORTRAIT} type="image/avif" srcSet={`${tall.dir}/blur.avif`} />
        <source media={PORTRAIT} type="image/webp" srcSet={`${tall.dir}/blur.webp`} />
        <source type="image/avif" srcSet={`${wide.dir}/blur.avif`} />
        <img ref={imgRef} src={`${wide.dir}/blur.webp`} alt="" width={wide.w} height={wide.h} fetchPriority="high" decoding="async" className="hero-photo" />
      </picture>
    )
  return (
    <picture>
      <source media={PORTRAIT} type="image/avif" srcSet={srcSet(tall, 'avif')} sizes="100vw" />
      <source media={PORTRAIT} type="image/webp" srcSet={srcSet(tall, 'webp')} sizes="100vw" />
      <source type="image/avif" srcSet={srcSet(wide, 'avif')} sizes="100vw" />
      <img ref={imgRef} src={largest(wide)} srcSet={srcSet(wide, 'webp')} sizes="100vw" alt="" width={wide.w} height={wide.h} decoding="async" className="hero-photo" />
    </picture>
  )
}

export function HeroFocus({ frames, photo }: { frames: HeroFrame[]; photo?: { wide: MediaImage; tall: MediaImage } | null }) {
  const heroRef = useRef<HTMLElement>(null)
  const backdropRef = useRef<HTMLImageElement>(null)
  const sharpRef = useRef<HTMLImageElement>(null)
  // the sharp photograph (a few hundred KB) waits for the visitor's first move, like the 3D
  const [sharp, setSharp] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<HeroEngine | null>(null)
  const [fi, setFi] = useState(0)
  const [vi, setVi] = useState(0)
  const [gl, setGl] = useState(false)
  const [touched, setTouched] = useState(false)
  const frame = frames[fi]!
  const variant = frame.variants[vi] ?? frame.variants[0]!

  // CSS fallback: the DOM lens and the CSS 3D frame follow a mouse cursor until WebGL takes over.
  // Nothing runs per frame unless the cursor moves — the idle sway is a compositor-only CSS animation.
  useEffect(() => {
    const hero = heroRef.current
    if (!hero || gl) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches || window.innerWidth < 1024) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = { x: 0.62, y: 0.44 }
    const c = { x: 0.62, y: 0.44 }
    let raf = 0
    const tick = () => {
      const k = reduce ? 1 : 0.14
      c.x += (t.x - c.x) * k
      c.y += (t.y - c.y) * k
      const st = hero.style
      st.setProperty('--mx', `${(c.x * 100).toFixed(2)}%`)
      st.setProperty('--my', `${(c.y * 100).toFixed(2)}%`)
      st.setProperty('--ry', `${((c.x - 0.5) * 54).toFixed(2)}deg`)
      st.setProperty('--rx', `${(4 - (c.y - 0.5) * 30).toFixed(2)}deg`)
      st.setProperty('--spec', `${(c.x * 70 - 35).toFixed(1)}px`)
      raf = Math.abs(t.x - c.x) + Math.abs(t.y - c.y) > 0.0008 ? requestAnimationFrame(tick) : 0
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const r = hero.getBoundingClientRect()
      t.x = (e.clientX - r.left) / r.width
      t.y = (e.clientY - r.top) / r.height
      hero.dataset.pointer = ''
      if (!raf) raf = requestAnimationFrame(tick)
    }
    const onLeave = () => delete hero.dataset.pointer
    hero.addEventListener('pointermove', onMove)
    hero.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      hero.removeEventListener('pointermove', onMove)
      hero.removeEventListener('pointerleave', onLeave)
    }
  }, [gl])

  useEffect(() => {
    if (!photo) return
    return onFirstInteraction(() => setSharp(true))
  }, [photo])

  // WebGL
  useEffect(() => {
    const hero = heroRef.current
    const canvas = canvasRef.current
    const anchor = anchorRef.current
    const chart = chartRef.current
    if (!hero || !canvas || !anchor || !chart) return
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (conn?.saveData) return
    let cancelled = false
    const start = async () => {
      const probe = document.createElement('canvas')
      if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return
      try {
        const { startHeroEngine } = await import('@/components/three/hero-engine')
        if (cancelled) return
        engineRef.current = await startHeroEngine({
          canvas,
          hero,
          anchor,
          chart,
          frames: frames.map((f) => ({ spec: f.art as FrameSpec, templeLength: f.templeLength, variants: f.variants })),
          frame: 0,
          variant: 0,
          backdrop: backdropRef.current,
          photo: photo ? () => sharpRef.current : undefined,
          onReady: () => !cancelled && setGl(true),
          onInteract: () => setTouched(true),
        })
      } catch (e) {
        console.warn('3D hero unavailable', e)
      }
    }
    // three.js waits for the visitor's first move — the first load stays light and the CSS frame is complete on its own
    let idle = 0
    const stop = onFirstInteraction(() => {
      if ('requestIdleCallback' in window) idle = window.requestIdleCallback(() => void start(), { timeout: 600 })
      else void start()
    })
    return () => {
      cancelled = true
      stop()
      if (idle) window.cancelIdleCallback(idle)
      engineRef.current?.dispose()
      engineRef.current = null
    }
    // frames are static props for the lifetime of the page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // a tiny tick under the finger when the glasses change (Android; ignored elsewhere)
  const tick = () => navigator.vibrate?.(8)
  const showFrame = (i: number) => {
    tick()
    setFi(i)
    setVi(0)
    engineRef.current?.show(i, 0)
  }
  const showVariant = (i: number) => {
    tick()
    setVi(i)
    engineRef.current?.show(fi, i)
  }

  return (
    <section
      ref={heroRef}
      aria-label="Sifra Vision — de la neclar la clar"
      data-gl={gl ? 'on' : undefined}
      className="hero-focus relative -mt-[var(--header-h)] overflow-hidden bg-fog"
      style={{ ['--mx' as string]: '62%', ['--my' as string]: '44%', ['--r' as string]: 'var(--lens-r)' }}
    >
      {/* the city in fog: out of focus everywhere but through the lenses */}
      {photo ? <Photo photo={photo} sharp={false} imgRef={backdropRef} /> : null}
      {/* blurred optotype */}
      <div ref={chartRef} aria-hidden className="hero-chart chart-blur absolute opacity-[.42]">
        <EyeChart />
      </div>
      {/* CSS fallback: sharp optotype inside a cursor lens */}
      <div aria-hidden className="hero-domlens pointer-events-none absolute inset-0" style={{ clipPath: 'circle(var(--r) at var(--mx) var(--my))' }}>
        <div className="absolute inset-0 bg-glass" style={{ transformOrigin: 'var(--mx) var(--my)', transform: 'scale(1.12)' }}>
          {photo && sharp ? <Photo photo={photo} sharp imgRef={sharpRef} /> : null}
          <div className="hero-chart absolute text-ink">
            <EyeChart />
          </div>
        </div>
      </div>
      <div aria-hidden className="hero-domlens lens-ring pointer-events-none absolute z-[6]" style={{ left: 'var(--mx)', top: 'var(--my)', width: 'calc(var(--r) * 2)', height: 'calc(var(--r) * 2)', margin: 'calc(var(--r) * -1) 0 0 calc(var(--r) * -1)' }}>
        <div className="absolute left-1/2 top-1/2 -ml-[3px] -mt-[3px] size-1.5 rounded-full bg-cobalt" />
        <div className="absolute left-[22%] top-[10%] h-[16%] w-[34%] rotate-[-24deg] rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,.65), rgba(255,255,255,0))' }} />
        <div className="eyebrow absolute -bottom-[30px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-ink max-lg:hidden">FOCUS 100%</div>
      </div>

      {/* WebGL glasses */}
      <canvas ref={canvasRef} aria-hidden className="hero-gl" />

      {/* layout anchor + CSS 3D fallback */}
      <div ref={anchorRef} aria-hidden data-cursor={gl ? 'Trage' : undefined} className="hero-frame absolute z-[8]" style={{ perspective: 1400 }}>
        <div className="hero-frame-art pointer-events-none">
          <div className="animate-float" style={{ transformStyle: 'preserve-3d' }}>
            <div className="frame3d-sway" style={{ transformStyle: 'preserve-3d' }}>
              <Frame3D art={frame.art} swatch={variant.swatch} widthPx={560} />
            </div>
          </div>
          <div className="absolute inset-x-[14%] -bottom-[60px] h-6 rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(13,18,22,.22), rgba(13,18,22,0))' }} />
        </div>
      </div>

      {/* frame tag + switcher (desktop) */}
      <div className="hero-tag absolute z-[9] hidden flex-col items-end gap-4 lg:flex" style={{ animation: 'fadeup .8s var(--ease-out-expo) both', animationDelay: 'calc(var(--intro-delay) + .75s)' }}>
        <Link href={`/rame/${frame.slug}`} className="group flex items-center gap-3 no-underline">
          <span className="h-px w-16 bg-ink transition-[width] duration-500 group-hover:w-24" />
          <span className="flex flex-col gap-1">
            <span className="text-[15px] font-bold">
              {frame.name} — <span className="hero-accent-inline">{variant.name.toLowerCase()}</span>
            </span>
            <span className="spec">
              {frame.kind} · {frame.spec} · {frame.price}
            </span>
          </span>
        </Link>
        <Controls frames={frames} fi={fi} vi={vi} onFrame={showFrame} onVariant={showVariant} />
        <Hint show={gl && !touched} />
      </div>

      {/* switcher (mobile) */}
      <div className="hero-controls-m absolute left-1/2 z-[11] flex -translate-x-1/2 flex-col items-center gap-2 lg:hidden">
        <Controls frames={frames} fi={fi} vi={vi} onFrame={showFrame} onVariant={showVariant} />
        <Hint show={gl && !touched} touch />
      </div>

      {/* copy */}
      <div className="hero-copy relative z-10 container-x">
        <div>
          <p className="hero-kicker">
            <span className="text-ink">Sifra Vision</span>
            <span aria-hidden className="h-px w-10 bg-ink/40" />
            <span>Optică · Galați</span>
          </p>
          <KineticTitle className="disp hero-title m-0 text-ink" />
        </div>
        <div className="hero-side flex flex-col gap-5" style={{ animation: 'fadeup .8s var(--ease-out-expo) both', animationDelay: 'calc(var(--intro-delay) + .95s)' }}>
          <p className="m-0 text-[17px] leading-[1.5] text-ink-2 lg:text-[18px]">
            Rame moderne, ușoare și confortabile, create pentru fiecare zi. Le probezi pe față din telefon, vezi prețul cu lentile pe loc și le ridici din Galați.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link data-magnetic href="/proba-virtuala" className="btn btn-primary max-lg:flex-1">
              <Icon name="camera" size={20} />
              Probează virtual
            </Link>
            <Link data-magnetic href="/rame-de-vedere" className="btn btn-secondary max-lg:flex-1">
              Vezi ramele
            </Link>
          </div>
          <div className="spec">Rame 189–549 lei · Ridicare din Str. Alexandru Cernat 188</div>
        </div>
      </div>

      {/* scroll cue */}
      <div className="absolute bottom-7 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-3.5 lg:flex">
        <div className="relative h-9 w-px overflow-hidden bg-line">
          <div className="absolute inset-0 animate-cue bg-ink" />
        </div>
        <span className="eyebrow">Derulează — totul intră în focus</span>
      </div>

      <div className="grain z-30" aria-hidden />

    </section>
  )
}
