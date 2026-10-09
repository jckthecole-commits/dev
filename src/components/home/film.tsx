'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import type { MediaVideo } from '@/lib/media'
import { onFirstInteraction } from '@/lib/interaction'

type Chapter = { at: number; eyebrow: string; title: string; body: string }

const CHAPTERS: Chapter[] = [
  { at: 0, eyebrow: 'Sifra Vision', title: 'Totul începe cu o lentilă.', body: 'Măsurată pe pupila ta, montată și verificată în laboratorul nostru din Galați.' },
  { at: 0.26, eyebrow: 'Prin ea', title: 'Uită-te prin ea.', body: 'Ceața din jur rămâne ceață. Ce e în fața ta devine limpede.' },
  { at: 0.56, eyebrow: 'Dunărea, la Galați', title: 'Și orașul intră în focus.', body: 'Faleza, șlepurile, macaralele de pe malul celălalt — clare până la ultimul rând.' },
]
/** from here on the end card: the name, the city, the door */
const END = 0.8

/**
 * „Prin lentilă”: a film scrubbed by the scroll. The camera starts on a pair of glasses
 * in the fog, goes through the right lens and comes out over the Danube at Galați in
 * sharp focus. The poster is the film's first frame; the clip (a few MB, short GOP so
 * every frame seeks fast) is fetched whole as a Blob once the section is near and the
 * visitor has interacted, then its time follows the scroll position, both ways.
 */
export function FilmScrub({ video, address }: { video: MediaVideo; address: string }) {
  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    const stage = stageRef.current
    const el = videoRef.current
    if (!section || !stage || !el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // ── progress → chapter, end card and the bar (cheap, runs even before the clip is in)
    let p = 0
    const measure = () => {
      const r = section.getBoundingClientRect()
      const span = Math.max(1, r.height - window.innerHeight)
      p = Math.min(1, Math.max(0, -r.top / span))
      let ch = 0
      for (let i = 0; i < CHAPTERS.length; i++) if (p >= CHAPTERS[i]!.at) ch = i
      const next = p >= END ? 'end' : String(ch)
      if (stage.dataset.chapter !== next) stage.dataset.chapter = next
      stage.style.setProperty('--p', p.toFixed(4))
    }
    measure()

    // ── the clip: whole file as a Blob (instant seeks, no range requests mid-scrub)
    let url = ''
    let cancelled = false
    let stopWaiting = () => {}
    const load = () => {
      stopWaiting = onFirstInteraction(async () => {
        const small = window.matchMedia('(max-width: 767px), (max-height: 520px)').matches
        try {
          const res = await fetch(`${video.dir}/${small ? 'mobile' : 'desktop'}.mp4`)
          if (!res.ok || cancelled) return
          url = URL.createObjectURL(await res.blob())
          if (cancelled) return URL.revokeObjectURL(url)
          el.src = url
          el.addEventListener('loadeddata', () => (stage.dataset.ready = ''), { once: true })
          el.load()
        } catch {
          /* the poster and the chapters still tell the story */
        }
      })
    }
    const near = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return
        near.disconnect()
        if (!reduce) load()
      },
      { rootMargin: '150% 0px' },
    )
    near.observe(section)

    // ── scroll → time: ease towards the target, one seek in flight at a time
    let visible = false
    const seen = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting))
    seen.observe(section)
    let shown = 0
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!visible) return
      measure()
      if (!el.duration || el.readyState < 2) return
      const target = p * (el.duration - 0.04)
      shown += (target - shown) * 0.22
      if (Math.abs(target - shown) < 0.002) shown = target
      if (!el.seeking && Math.abs(el.currentTime - shown) > 1 / 90) el.currentTime = shown
    }
    raf = requestAnimationFrame(tick)
    const onResize = () => measure()
    window.addEventListener('resize', onResize, { passive: true })

    return () => {
      cancelled = true
      stopWaiting()
      cancelAnimationFrame(raf)
      near.disconnect()
      seen.disconnect()
      window.removeEventListener('resize', onResize)
      if (url) URL.revokeObjectURL(url)
    }
  }, [video])

  return (
    <section ref={sectionRef} aria-labelledby="film-title" className="film">
      <div ref={stageRef} className="film-stage" data-chapter="0">
        <div className="film-media" aria-hidden>
          <picture>
            <source media="(max-width: 767px)" type="image/avif" srcSet={`${video.dir}/poster-m.avif`} />
            <source media="(max-width: 767px)" type="image/webp" srcSet={`${video.dir}/poster-m.webp`} />
            <source type="image/avif" srcSet={`${video.dir}/poster.avif`} />
            <img src={`${video.dir}/poster.webp`} alt="" width={video.w} height={video.h} loading="lazy" decoding="async" className="film-poster" />
          </picture>
          <video ref={videoRef} className="film-video" muted playsInline preload="none" disableRemotePlayback tabIndex={-1} />
          {video.endPoster ? (
            <picture>
              <source type="image/avif" srcSet={`${video.dir}/end.avif`} />
              <img src={`${video.dir}/end.webp`} alt="" width={video.w} height={video.h} loading="lazy" decoding="async" className="film-end" />
            </picture>
          ) : null}
        </div>
        <div className="film-veil" aria-hidden />

        <h2 id="film-title" className="sr-only">
          Prin lentilă: Galați, în focus
        </h2>
        <ol className="film-chapters">
          {CHAPTERS.map((c, i) => (
            <li key={c.title} data-i={i} className="film-chapter">
              <div className="eyebrow mb-4">{c.eyebrow}</div>
              <p className="film-chapter-title disp">{c.title}</p>
              <p className="film-chapter-body">{c.body}</p>
            </li>
          ))}
        </ol>

        <div className="film-endcard">
          <p className="film-wordmark" aria-label="Sifra Vision">
            <span>SIFRA</span> <span>VISION</span>
          </p>
          <p className="film-endline">
            Optică · Galați · <span className="whitespace-nowrap">{address}</span>
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/programare" className="btn btn-ink">
              Programează o consultație
            </Link>
            <Link href="/rame-de-vedere" className="btn btn-secondary">
              Vezi ramele
            </Link>
          </div>
        </div>

        <div className="film-progress" aria-hidden>
          <span />
        </div>
      </div>
    </section>
  )
}
