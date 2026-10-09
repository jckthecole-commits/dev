'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { onFirstInteraction } from '@/lib/interaction'
import { rich } from './sections'
import type { Pit } from './pit-engine'

export type PitFrame = { slug: string; name: string; price: string; src: string; box: [number, number]; pile: { x: number; y: number; r: number } }

const motionOk = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches
const noSubscribe = () => () => {}

/**
 * The whole collection in one heap — real physics, real relative sizes. Without
 * JavaScript (or with reduced motion) it is a still life of the same heap.
 */
export function FramePit({ frames, title }: { frames: PitFrame[]; title: string }) {
  const live = useSyncExternalStore(noSubscribe, motionOk, () => false)
  const router = useRouter()
  const sectionRef = useRef<HTMLElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const els = useRef<(HTMLAnchorElement | null)[]>([])
  const tagRef = useRef<HTMLAnchorElement>(null)
  const pit = useRef<Pit | null>(null)
  const activeRef = useRef<number | null>(null)
  const [active, setActive] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [tiltAsk, setTiltAsk] = useState(false)

  const show = (i: number | null) => {
    activeRef.current = i
    setActive(i)
  }

  useEffect(() => {
    if (!live) return
    const section = sectionRef.current!
    let disposed = false
    let stopWaiting = () => {}
    let started = false
    // load when the heap is near, start the fall once it is properly in view
    const io = new IntersectionObserver(
      ([en]) => {
        if (!en?.isIntersecting || started) return
        started = true
        io.disconnect()
        stopWaiting = onFirstInteraction(async () => {
          const { startPit } = await import('./pit-engine')
          if (disposed || !boxRef.current) return
          const coarse = window.matchMedia('(pointer: coarse)').matches
          const count = coarse ? Math.min(frames.length, 14) : frames.length
          const nodes = els.current.slice(0, count).filter(Boolean) as HTMLElement[]
          pit.current = startPit({
            box: boxRef.current,
            els: nodes,
            sizes: nodes.map((n) => ({ w: n.offsetWidth, h: n.offsetHeight })),
            onHover: (i) => {
              if (activeRef.current !== i) show(i)
            },
            onTap: (i) => {
              if (!coarse || activeRef.current === i) router.push(`/rame/${frames[i]!.slug}`)
              else show(i)
            },
            onFrame: (pos) => {
              const i = activeRef.current
              const tag = tagRef.current
              if (i == null || !tag || !pos[i]) return
              tag.style.transform = `translate3d(${pos[i].x.toFixed(0)}px,${pos[i].y.toFixed(0)}px,0) translate(-50%,-100%)`
            },
          })
          setRunning(true)
          // tilt: Android just works; iOS needs a tap to ask (button below)
          if (coarse && 'DeviceOrientationEvent' in window) {
            const ask = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission
            if (ask) setTiltAsk(true)
            else window.addEventListener('deviceorientation', onTilt)
          }
        })
      },
      { threshold: 0.3 },
    )
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null) return
      pit.current?.tilt(Math.max(-1.4, Math.min(1.4, e.gamma / 32)), 1.1)
    }
    io.observe(section)
    return () => {
      disposed = true
      io.disconnect()
      stopWaiting()
      window.removeEventListener('deviceorientation', onTilt)
      pit.current?.dispose()
      pit.current = null
    }
  }, [live, frames, router])

  const askTilt = async () => {
    const ask = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission
    if (!ask) return
    if ((await ask()) === 'granted') {
      setTiltAsk(false)
      window.addEventListener('deviceorientation', (e) => {
        if (e.gamma != null) pit.current?.tilt(Math.max(-1.4, Math.min(1.4, e.gamma / 32)), 1.1)
      })
    }
  }

  const f = active != null ? frames[active] : null
  return (
    <section ref={sectionRef} aria-labelledby="gramada" className="pit" data-live={live ? '' : undefined} data-running={running ? '' : undefined}>
      <div className="container-x pit-head">
        <div>
          <div className="eyebrow mb-3">{frames.length} rame · la scară între ele</div>
          <h2 id="gramada" data-split className="disp text-[clamp(34px,4.6vw,60px)]">
            {rich(title)}
          </h2>
        </div>
        <div className="pit-actions">
          <p className="max-w-xs text-[15px] leading-relaxed text-ink-2">{live ? 'Prinde o ramă și arunc-o. Pe telefon, înclină-l.' : 'Fiecare ramă e desenată la mărimea ei reală față de celelalte.'}</p>
          {running ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => pit.current?.shake()} className="btn btn-secondary btn-sm">
                Scutură
              </button>
              <button type="button" onClick={() => pit.current?.drop()} className="btn btn-ghost btn-sm">
                Din nou
              </button>
              {tiltAsk ? (
                <button type="button" onClick={askTilt} className="btn btn-ink btn-sm">
                  Înclină telefonul
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div ref={boxRef} className="pit-box">
        <div aria-hidden className="pit-word">
          {frames.length} rame
        </div>
        {frames.map((fr, i) => (
          <Link
            key={fr.slug}
            ref={(el) => void (els.current[i] = el)}
            href={`/rame/${fr.slug}`}
            tabIndex={-1}
            aria-hidden
            draggable={false}
            onClick={(e) => running && e.preventDefault()}
            className="pit-frame"
            style={{ ['--mm' as string]: fr.box[0], left: `${fr.pile.x}%`, bottom: `${fr.pile.y}%`, rotate: `${fr.pile.r}deg` }}
          >
            <img src={fr.src} alt="" width={Math.round(fr.box[0] * 10)} height={Math.round(fr.box[1] * 10)} loading="lazy" decoding="async" draggable={false} />
          </Link>
        ))}
        <Link ref={tagRef} href={f ? `/rame/${f.slug}` : '#'} tabIndex={-1} aria-hidden className="pit-tag" data-on={f ? '' : undefined}>
          {f ? (
            <>
              <strong>{f.name}</strong> <span>{f.price}</span>
            </>
          ) : null}
        </Link>
      </div>

      {/* the heap is a toy; the same frames, as plain links */}
      <ul className="sr-only">
        {frames.map((fr) => (
          <li key={fr.slug}>
            <Link href={`/rame/${fr.slug}`}>
              {fr.name}, {fr.price}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
