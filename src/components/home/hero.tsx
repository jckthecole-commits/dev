'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { FrameArt, type FrameArtProduct } from '@/components/frame-art'
import { Icon } from '@/components/icons'
import type { Swatch } from '@/lib/db/schema'
import { frameLayout, type FrameSpec } from '@/lib/frame-geometry'

export type HeroFrame = { slug: string; name: string; colorName: string; spec: string; price: string; art: FrameArtProduct; swatch: Swatch }

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

const TITLE = ['Când stilul', 'ține pasul', 'cu tine.']

function KineticTitle({ className }: { className?: string }) {
  let i = 0
  return (
    <h1 className={className} aria-label={TITLE.join(' ')}>
      {TITLE.map((line) => (
        <span key={line} aria-hidden="true" className="block whitespace-nowrap">
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
      ))}
    </h1>
  )
}

/** 3D frame: stacked silhouettes give real thickness; temples fold back in CSS 3D. */
function Frame3D({ frame, widthPx }: { frame: HeroFrame; widthPx: number }) {
  const L = frameLayout(frame.art as FrameSpec)
  const [, vy, vw, vh] = L.viewBox
  const k = widthPx / vw
  const heightPx = vh * k
  const hingeTop = (L.hingeY - vy) * k
  const hingeInset = (vw / 2 - L.hingeX) * k
  const templeLen = 82 * k
  const templeH = Math.max(4, L.rimW * k * 0.9)
  const metal = frame.art.material === 'metal' || frame.art.material === 'titan'
  const templeBg = metal ? 'linear-gradient(#C9CED2,#6B737A)' : 'linear-gradient(#3A434B,#1B2025)'
  return (
    <div className="frame3d relative" style={{ width: widthPx, height: heightPx, transformStyle: 'preserve-3d' }}>
      {[-7, -4.5, -2].map((z, idx) => (
        <div key={z} className="absolute inset-0" style={{ transform: `translateZ(${z}px)` }}>
          <FrameArt product={frame.art} swatch={frame.swatch} mode="rim" rimColor={['#07090B', '#0E1215', '#161B20'][idx]} className="h-full w-full" idSalt={`z${z}`} />
        </div>
      ))}
      <div className="absolute inset-0">
        <FrameArt product={frame.art} swatch={frame.swatch} className="h-full w-full" temples={false} />
      </div>
      <div className="absolute rounded-md" style={{ left: hingeInset - 2, top: hingeTop - templeH / 2, width: templeLen, height: templeH, background: templeBg, transformOrigin: 'left center', transform: 'rotateY(96deg)' }} />
      <div className="absolute rounded-md" style={{ right: hingeInset - 2, top: hingeTop - templeH / 2, width: templeLen, height: templeH, background: templeBg, transformOrigin: 'right center', transform: 'rotateY(-96deg)' }} />
    </div>
  )
}

export function HeroFocus({ frame }: { frame: HeroFrame }) {
  const heroRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarse = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 1024
    const t = { x: 0.62, y: 0.44 }
    const c = { x: 0.62, y: 0.44 }
    const tilt = { x: 0, y: 0 }
    let active = false
    let visible = true
    let raf = 0
    let t0 = performance.now()

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const r = hero.getBoundingClientRect()
      t.x = (e.clientX - r.left) / r.width
      t.y = (e.clientY - r.top) / r.height
      active = true
    }
    const onLeave = () => {
      active = false
      t0 = performance.now()
    }
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return
      tilt.x = Math.max(-1, Math.min(1, e.gamma / 30))
      tilt.y = Math.max(-1, Math.min(1, (e.beta - 45) / 30))
    }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (!visible) return
      const s = (now - t0) / 1000
      let tx = t.x
      let ty = t.y
      if (coarse) {
        tx = 0.5
        ty = 0.5
      } else if (!active && !reduce) {
        tx = 0.56 + 0.1 * Math.sin(s * 0.45)
        ty = 0.4 + 0.13 * Math.sin(s * 0.72 + 1)
      }
      const k = reduce ? 1 : 0.09
      c.x += (tx - c.x) * k
      c.y += (ty - c.y) * k
      const st = hero.style
      if (!coarse) {
        st.setProperty('--mx', `${(c.x * 100).toFixed(2)}%`)
        st.setProperty('--my', `${(c.y * 100).toFixed(2)}%`)
      }
      const ry = coarse ? tilt.x * 18 + (reduce ? 0 : Math.sin(s * 1.2) * 14) : (c.x - 0.5) * 54
      const rx = coarse ? 4 - tilt.y * 10 : 4 - (c.y - 0.5) * 30
      st.setProperty('--ry', `${ry.toFixed(2)}deg`)
      st.setProperty('--rx', `${rx.toFixed(2)}deg`)
      st.setProperty('--spec', `${((coarse ? 0.5 + ry / 60 : c.x) * 70 - 35).toFixed(1)}px`)
    }

    const io = new IntersectionObserver(([en]) => (visible = !!en?.isIntersecting))
    io.observe(hero)
    hero.addEventListener('pointermove', onMove)
    hero.addEventListener('pointerleave', onLeave)
    if (coarse) window.addEventListener('deviceorientation', onOrient)
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      hero.removeEventListener('pointermove', onMove)
      hero.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('deviceorientation', onOrient)
    }
  }, [])

  return (
    <section
      ref={heroRef}
      aria-label="Sifra Vision — de la neclar la clar"
      suppressHydrationWarning
      className="hero-focus relative -mt-[var(--header-h)] overflow-hidden bg-fog"
      style={{ ['--mx' as string]: '62%', ['--my' as string]: '44%', ['--r' as string]: 'var(--lens-r)' }}
    >
      {/* Plays the intro once per session — decided before first paint. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var e=document.currentScript.parentElement;try{if(sessionStorage.getItem('sv-intro')||matchMedia('(prefers-reduced-motion: reduce)').matches){e.dataset.intro='skip'}else{sessionStorage.setItem('sv-intro','1');e.dataset.intro='play'}}catch(_){e.dataset.intro='skip'}})()`,
        }}
      />

      {/* blurred optotype */}
      <div aria-hidden className="hero-chart absolute text-ink opacity-[.42] blur-[10px]">
        <EyeChart />
      </div>
      {/* sharp optotype inside the lens */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ clipPath: 'circle(var(--r) at var(--mx) var(--my))' }}>
        <div className="absolute inset-0 bg-glass" style={{ transformOrigin: 'var(--mx) var(--my)', transform: 'scale(1.12)' }}>
          <div className="hero-chart absolute text-ink">
            <EyeChart />
          </div>
        </div>
      </div>
      {/* lens ring */}
      <div aria-hidden className="lens-ring pointer-events-none absolute z-[6]" style={{ left: 'var(--mx)', top: 'var(--my)', width: 'calc(var(--r) * 2)', height: 'calc(var(--r) * 2)', margin: 'calc(var(--r) * -1) 0 0 calc(var(--r) * -1)' }}>
        <div className="absolute left-1/2 top-1/2 -ml-[3px] -mt-[3px] size-1.5 rounded-full bg-cobalt" />
        <div className="absolute left-[22%] top-[10%] h-[16%] w-[34%] rotate-[-24deg] rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,.65), rgba(255,255,255,0))' }} />
        <div className="eyebrow absolute -bottom-[30px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-ink">FOCUS 100%</div>
      </div>

      {/* 3D frame */}
      <div aria-hidden className="hero-frame pointer-events-none absolute z-[8]" style={{ perspective: 1400 }}>
        <div className="animate-float" style={{ transformStyle: 'preserve-3d' }}>
          <div className="hidden lg:block">
            <Frame3D frame={frame} widthPx={560} />
          </div>
          <div className="lg:hidden">
            <Frame3D frame={frame} widthPx={290} />
          </div>
        </div>
        <div className="absolute inset-x-[14%] -bottom-[60px] h-6 rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(13,18,22,.22), rgba(13,18,22,0))' }} />
      </div>

      {/* frame tag */}
      <Link href={`/rame/${frame.slug}`} className="hero-tag absolute z-[9] hidden items-center gap-3 no-underline lg:flex" style={{ animation: 'fadeup .8s var(--ease-out-expo) both', animationDelay: 'calc(var(--intro-delay) + .75s)' }}>
        <span className="h-px w-16 bg-ink" />
        <span className="flex flex-col gap-1">
          <span className="text-[15px] font-bold">
            {frame.name} — {frame.colorName.toLowerCase()}
          </span>
          <span className="spec">
            {frame.spec} · {frame.price}
          </span>
        </span>
      </Link>

      {/* copy */}
      <div className="hero-copy relative z-10 container-x">
        <KineticTitle className="disp hero-title m-0 text-ink" />
        <div className="hero-side flex flex-col gap-5" style={{ animation: 'fadeup .8s var(--ease-out-expo) both', animationDelay: 'calc(var(--intro-delay) + .95s)' }}>
          <p className="m-0 text-[17px] leading-[1.5] text-ink-2 lg:text-[18px]">
            Rame moderne, ușoare și confortabile, create pentru fiecare zi. Le probezi pe față din telefon, vezi prețul cu lentile pe loc și le ridici din Galați.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/proba-virtuala" className="btn btn-primary max-lg:flex-1">
              <Icon name="camera" size={20} />
              Probează virtual
            </Link>
            <Link href="/rame-de-vedere" className="btn btn-secondary max-lg:flex-1">
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

      {/* intro: ring draws, wordmark focuses, iris opens */}
      <div aria-hidden className="intro pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-fog">
        <div className="relative grid place-items-center">
          <svg width="200" height="200" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="90" fill="none" stroke="#0D1216" strokeWidth="1.5" transform="rotate(-90 100 100)" style={{ strokeDasharray: 566, strokeDashoffset: 566, animation: 'draw .7s cubic-bezier(.65,0,.35,1) .05s forwards' }} />
          </svg>
          <div className="disp-wide absolute whitespace-nowrap text-[26px] font-semibold tracking-[0.18em] sm:text-[30px]" style={{ animation: 'word-focus .6s var(--ease-out-soft) .45s both' }}>
            SIFRA VISION
          </div>
        </div>
      </div>
    </section>
  )
}
