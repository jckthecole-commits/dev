'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { Icon } from '@/components/icons'
import type { MediaVideo } from '@/lib/media'
import { HeroKicker, KineticTitle } from './hero'

const SMALL = '(max-width: 767px)'

/**
 * The hero as a film: one continuous take stitched from generated transitions (into the
 * pupil → the glasses spin and turn to chrome → through the mirrored lens into the city),
 * looping without a seam. The first frame is a still (the LCP, a few KB); the film itself
 * starts only once the page has loaded and gone idle, pauses off screen, and never plays
 * for reduced motion or Save-Data.
 */
export function HeroReel({ reel }: { reel: MediaVideo }) {
  const sectionRef = useRef<HTMLElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    const v = videoRef.current
    if (!section || !v) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return
    let started = false
    let onScreen = true
    const play = () => {
      if (started && onScreen) v.play().catch(() => {})
    }
    const start = () => {
      started = true
      v.preload = 'auto'
      v.addEventListener('playing', () => (section.dataset.playing = ''), { once: true })
      play()
    }
    // requestIdleCallback is missing in older Safari: a short timeout stands in
    const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300))
    let idle = 0
    const later = () => (idle = ric(start, { timeout: 1500 }))
    if (document.readyState === 'complete') later()
    else window.addEventListener('load', later, { once: true })
    const io = new IntersectionObserver(([e]) => {
      onScreen = !!e?.isIntersecting
      if (onScreen) play()
      else v.pause()
    })
    io.observe(section)
    return () => {
      window.removeEventListener('load', later)
      ;(window.cancelIdleCallback ?? window.clearTimeout)(idle)
      io.disconnect()
      v.pause()
    }
  }, [])

  return (
    <section ref={sectionRef} aria-label="Sifra Vision — rame de vedere și ochelari de soare" data-tone="dark" className="reel">
      <div className="reel-media" aria-hidden>
        <picture>
          <source media={SMALL} type="image/avif" srcSet={`${reel.dir}/poster-m.avif`} />
          <source media={SMALL} type="image/webp" srcSet={`${reel.dir}/poster-m.webp`} />
          <source type="image/avif" srcSet={`${reel.dir}/poster.avif`} />
          <img src={`${reel.dir}/poster.webp`} alt="" width={reel.w} height={reel.h} fetchPriority="high" decoding="async" className="reel-poster" />
        </picture>
        <video ref={videoRef} className="reel-video" muted loop playsInline preload="none" disableRemotePlayback tabIndex={-1}>
          {reel.av1 ? <source media={SMALL} src={`${reel.dir}/mobile-av1.mp4`} type='video/mp4; codecs="av01.0.04M.08"' /> : null}
          <source media={SMALL} src={`${reel.dir}/mobile.mp4`} type="video/mp4" />
          {reel.av1 ? <source src={`${reel.dir}/desktop-av1.mp4`} type='video/mp4; codecs="av01.0.08M.08"' /> : null}
          <source src={`${reel.dir}/desktop.mp4`} type="video/mp4" />
        </video>
      </div>
      <div className="reel-veil" aria-hidden />

      <div className="reel-copy container-x">
        <div>
          <HeroKicker />
          <KineticTitle className="disp hero-title m-0" />
        </div>
        <div className="reel-side flex flex-col gap-5">
          <p className="m-0 text-[17px] leading-[1.5] text-white/80 lg:text-[18px]">
            Rame moderne, ușoare și confortabile, create pentru fiecare zi. Le probezi pe față din telefon, vezi prețul cu lentile pe loc și le ridici din Galați.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link data-magnetic href="/proba-virtuala" className="btn btn-primary max-lg:flex-1">
              <Icon name="camera" size={20} />
              Probează virtual
            </Link>
            <Link data-magnetic href="/rame-de-vedere" className="btn reel-btn max-lg:flex-1">
              Vezi ramele
            </Link>
          </div>
          <div className="spec text-white/60">Rame 189–549 lei · Ridicare din Str. Alexandru Cernat 188</div>
        </div>
      </div>
    </section>
  )
}
