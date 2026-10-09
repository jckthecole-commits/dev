'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/icons'
import { srcSet, type MediaImage } from '@/lib/media'
import { onFirstInteraction } from '@/lib/interaction'
import { rich } from './sections'

export type Locul = {
  place: string
  img: MediaImage
  /** the same scene through a polarized lens (glare gone) — when there is one */
  pol: MediaImage | null
  product: { slug: string; name: string; price: string; tagline: string | null; polarized: boolean; art: string; box: [number, number] }
}

function Scene({ m, className, eager }: { m: MediaImage; className: string; eager?: boolean }) {
  return (
    <picture>
      <source type="image/avif" srcSet={srcSet(m, 'avif')} sizes="100vw" />
      <img src={`${m.dir}/${m.widths[1] ?? m.widths[0]}.webp`} srcSet={srcSet(m, 'webp')} sizes="100vw" alt={m.alt ?? ''} width={m.w} height={m.h} loading={eager ? 'eager' : 'lazy'} decoding="async" className={className} />
    </picture>
  )
}

/**
 * „Locurile”: the sunglasses are named after places around Galați, so each one is shown
 * where it is worn. Picking a place pulls its scene into focus from where you clicked; a
 * polarized lens follows the pointer (or a finger) and takes the glare off the water.
 */
export function Locuri({ places, title }: { places: Locul[]; title: string }) {
  const [active, setActive] = useState(0)
  // scenes are fetched as they are picked — never all eight up front
  const [seen, setSeen] = useState<number[]>([0])
  const [prev, setPrev] = useState<number | null>(null)
  const [lensOn, setLensOn] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const lensRef = useRef<HTMLDivElement>(null)
  const cur = places[active]!

  const pick = (i: number, from?: { x: number; y: number }) => {
    if (i === active) return
    const st = stageRef.current
    if (st && from) {
      const r = st.getBoundingClientRect()
      st.style.setProperty('--fx', `${(((from.x - r.left) / r.width) * 100).toFixed(1)}%`)
      st.style.setProperty('--fy', `${(((from.y - r.top) / r.height) * 100).toFixed(1)}%`)
    }
    setPrev(active)
    setActive(i)
    setSeen((s) => (s.includes(i) ? s : [...s, i]))
  }

  // the polarized lens: loads with the first interaction, follows the mouse, drags on touch
  useEffect(() => {
    const st = stageRef.current
    const lens = lensRef.current
    if (!st || !lens) return
    const stop = onFirstInteraction(() => setLensOn(true))
    const pos = { x: 0.68, y: 0.62 }
    const goal = { ...pos }
    let raf = 0
    const tick = () => {
      pos.x += (goal.x - pos.x) * 0.2
      pos.y += (goal.y - pos.y) * 0.2
      st.style.setProperty('--lx', `${(pos.x * 100).toFixed(2)}%`)
      st.style.setProperty('--ly', `${(pos.y * 100).toFixed(2)}%`)
      raf = Math.abs(goal.x - pos.x) + Math.abs(goal.y - pos.y) > 0.0005 ? requestAnimationFrame(tick) : 0
    }
    const aim = (e: PointerEvent) => {
      const r = st.getBoundingClientRect()
      goal.x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
      goal.y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
      if (!raf) raf = requestAnimationFrame(tick)
    }
    let dragging = false
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || dragging) aim(e)
    }
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return
      dragging = true
      lens.setPointerCapture(e.pointerId)
      aim(e)
    }
    const onUp = () => (dragging = false)
    tick()
    st.addEventListener('pointermove', onMove)
    lens.addEventListener('pointerdown', onDown)
    lens.addEventListener('pointerup', onUp)
    lens.addEventListener('pointercancel', onUp)
    return () => {
      stop()
      cancelAnimationFrame(raf)
      st.removeEventListener('pointermove', onMove)
      lens.removeEventListener('pointerdown', onDown)
      lens.removeEventListener('pointerup', onUp)
      lens.removeEventListener('pointercancel', onUp)
    }
  }, [])

  return (
    <section aria-labelledby="locuri-title" data-tone="dark" className="locuri">
      <div ref={stageRef} className="locuri-stage" data-has-pol={cur.pol ? '' : undefined}>
        {/* the scenes: the previous one stays underneath while the new one pulls into focus */}
        {places.map((pl, i) =>
          seen.includes(i) ? (
            <div key={pl.place} className="locuri-scene" data-state={i === active ? 'in' : i === prev ? 'out' : 'off'} aria-hidden={i !== active}>
              <Scene m={pl.img} className="locuri-img" eager={i === 0} />
            </div>
          ) : null,
        )}

        {/* polarized lens */}
        <div ref={lensRef} className="locuri-lens" aria-hidden>
          {lensOn ? (
            <div key={cur.place} className="locuri-lens-view" data-css={cur.pol ? undefined : ''}>
              <Scene m={cur.pol ?? cur.img} className="locuri-img" eager />
            </div>
          ) : null}
        </div>
        <div className="locuri-lens-ring" aria-hidden>
          <span>Polarizat</span>
        </div>

        <div className="locuri-veil" aria-hidden />

        <div className="locuri-copy container-x">
          <div className="locuri-head">
            <div className="eyebrow mb-3 text-white/70">Ochelari de soare · Galați</div>
            <h2 id="locuri-title" className="disp text-[clamp(34px,4.6vw,64px)] text-white">
              {rich(title)}
            </h2>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/75">Fiecare pereche poartă numele unui loc de lângă casă. Plimbă lentila polarizată peste apă: reflexiile dispar.</p>
          </div>

          <ul className="locuri-list" aria-label="Locurile">
            {places.map((pl, i) => (
              <li key={pl.place}>
                <button type="button" aria-pressed={i === active} onClick={(e) => pick(i, e.detail ? { x: e.clientX, y: e.clientY } : undefined)} className="locuri-place">
                  <span className="locuri-place-name">{pl.place}</span>
                  <span className="locuri-place-meta">
                    {pl.product.name} · {pl.product.price}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div key={cur.place} className="locuri-card">
            <img src={cur.product.art} alt="" width={Math.round(cur.product.box[0] * 10)} height={Math.round(cur.product.box[1] * 10)} decoding="async" className="locuri-art" />
            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-[19px] font-bold text-ink">{cur.product.name}</p>
                <p className="font-mono text-[14px] text-ink tnum">{cur.product.price}</p>
              </div>
              {cur.product.tagline ? <p className="mt-1.5 text-[14px] leading-snug text-ink-2">{cur.product.tagline}</p> : null}
              <div className="mt-4 flex items-center justify-between gap-3">
                {cur.product.polarized ? <span className="badge-pol">Lentile polarizate</span> : <span />}
                <Link href={`/rame/${cur.product.slug}`} className="inline-flex items-center gap-1.5 text-[14px] font-bold text-cobalt no-underline">
                  Vezi modelul <Icon name="arrow-right" size={16} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
