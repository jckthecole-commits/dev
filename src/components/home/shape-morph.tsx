'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FrameArtProduct } from '@/components/frame-art'
import { Icon } from '@/components/icons'
import { frameLayout, type FrameSpec, type Pt } from '@/lib/frame-geometry'

export type MorphShape = {
  value: string
  plural: string
  href: string
  count: number
  intro: string
  /** A real frame of this shape — its outline and numbers are what morphs. */
  example: { name: string; href: string; spec: FrameArtProduct }
}

const N = 120

/** Clockwise (y down), starting at the temporal point on the horizontal axis, resampled by arc length. */
function normalize(pts: Pt[]): Pt[] {
  let area = 0
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i]!
    const [x1, y1] = pts[(i + 1) % pts.length]!
    area += x0 * y1 - x1 * y0
  }
  const ring = area < 0 ? [...pts].reverse() : pts
  let start = 0
  ring.forEach(([x, y], i) => {
    const [bx, by] = ring[start]!
    if (x - Math.abs(y) * 2 > bx - Math.abs(by) * 2) start = i
  })
  const r = [...ring.slice(start), ...ring.slice(0, start)]
  const seg = [0]
  for (let i = 1; i <= r.length; i++) {
    const a = r[i - 1]!
    const b = r[i % r.length]!
    seg.push(seg[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const total = seg[seg.length - 1]!
  const out: Pt[] = []
  let j = 0
  for (let k = 0; k < N; k++) {
    const t = (k / N) * total
    while (seg[j + 1]! < t) j++
    const a = r[j % r.length]!
    const b = r[(j + 1) % r.length]!
    const f = (t - seg[j]!) / (seg[j + 1]! - seg[j]! || 1)
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f])
  }
  return out
}

type Geo = { pts: Float32Array; cx: number; a: number; b: number; rim: number; bridgeX: number; bridgeY: number; hingeX: number; hingeY: number; A: number; B: number; dbl: number }

function geoOf(spec: FrameArtProduct): Geo {
  const L = frameLayout(spec as FrameSpec)
  const pts = normalize(L.outline)
  const flat = new Float32Array(N * 2)
  pts.forEach(([x, y], i) => {
    flat[i * 2] = x
    flat[i * 2 + 1] = y
  })
  return {
    pts: flat,
    cx: L.cx,
    a: L.a,
    b: L.b,
    rim: Math.max(1.6, Math.min(4.2, L.rimW)),
    bridgeX: L.bridgeX,
    bridgeY: L.bridgeY,
    hingeX: L.hingeX,
    hingeY: L.hingeY,
    A: spec.lensWidth,
    B: spec.lensHeight,
    dbl: spec.bridgeWidth,
  }
}

function lerpGeo(from: Geo, to: Geo, t: number, out: Geo) {
  for (let i = 0; i < N * 2; i++) out.pts[i] = from.pts[i]! + (to.pts[i]! - from.pts[i]!) * t
  for (const k of ['cx', 'a', 'b', 'rim', 'bridgeX', 'bridgeY', 'hingeX', 'hingeY', 'A', 'B', 'dbl'] as const) out[k] = from[k] + (to[k] - from[k]) * t
}

function cloneGeo(g: Geo): Geo {
  return { ...g, pts: new Float32Array(g.pts) }
}

const f = (n: number) => n.toFixed(2)

/** All path strings for one state of the morph. */
function draw(g: Geo) {
  const lens = (s: 1 | -1) => {
    let d = ''
    for (let i = 0; i < N; i++) d += `${i ? 'L' : 'M'}${f(s * (g.cx + g.pts[i * 2]!))} ${f(g.pts[i * 2 + 1]!)}`
    return d + 'Z'
  }
  const bx = g.bridgeX - g.rim * 0.4
  const by = g.bridgeY
  const arch = Math.max(2.2, g.dbl * 0.2)
  const bridge = `M${f(-bx)} ${f(by)}C${f(-bx * 0.45)} ${f(by - arch)} ${f(bx * 0.45)} ${f(by - arch)} ${f(bx)} ${f(by)}`
  const hinge = (s: 1 | -1) => `M${f(s * (g.hingeX - 1))} ${f(g.hingeY)}L${f(s * (g.hingeX + 5))} ${f(g.hingeY)}`
  const yA = g.b + g.rim + 7
  const xB = g.cx + g.a + g.rim + 7
  const tick = 2.2
  const dimA = `M${f(g.cx - g.a)} ${f(yA)}L${f(g.cx + g.a)} ${f(yA)}M${f(g.cx - g.a)} ${f(yA - tick)}L${f(g.cx - g.a)} ${f(yA + tick)}M${f(g.cx + g.a)} ${f(yA - tick)}L${f(g.cx + g.a)} ${f(yA + tick)}`
  const dimB = `M${f(xB)} ${f(-g.b)}L${f(xB)} ${f(g.b)}M${f(xB - tick)} ${f(-g.b)}L${f(xB + tick)} ${f(-g.b)}M${f(xB - tick)} ${f(g.b)}L${f(xB + tick)} ${f(g.b)}`
  const dimD = `M${f(-g.dbl / 2)} ${f(-g.b - g.rim - 7)}L${f(g.dbl / 2)} ${f(-g.b - g.rim - 7)}`
  return {
    lensR: lens(1),
    lensL: lens(-1),
    bridge,
    hingeR: hinge(1),
    hingeL: hinge(-1),
    dimA,
    dimB,
    dimD,
    textA: { x: g.cx, y: yA + 6.4, v: Math.round(g.A) },
    textB: { x: xB + 3, y: 1.6, v: Math.round(g.B) },
    textD: { x: 0, y: -g.b - g.rim - 9.5, v: Math.round(g.dbl) },
  }
}

export function ShapeMorph({ shapes }: { shapes: MorphShape[] }) {
  const geos = useMemo(() => shapes.map((s) => geoOf(s.example.spec)), [shapes])
  const [active, setActive] = useState(0)
  const [hovering, setHovering] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const cur = useRef<Geo | null>(null)
  const initial = useMemo(() => draw(geos[0]!), [geos])

  // a fixed box big enough for every shape, so the morph never rescales
  const box = useMemo(() => {
    const w = Math.max(...geos.map((g) => g.hingeX + 8))
    const h = Math.max(...geos.map((g) => g.b + g.rim + 16))
    return `${f(-w - 4)} ${f(-h - 2)} ${f(2 * w + 20)} ${f(2 * h + 4)}`
  }, [geos])

  // tween the drawing towards the active shape
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const to = geos[active]!
    const from = cloneGeo(cur.current ?? to)
    const live = cloneGeo(from)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const q = <T extends Element>(sel: string) => svg.querySelector<T>(sel)!
    const els = {
      lensR: q<SVGPathElement>('[data-m=lensR]'),
      lensL: q<SVGPathElement>('[data-m=lensL]'),
      bridge: q<SVGPathElement>('[data-m=bridge]'),
      hingeR: q<SVGPathElement>('[data-m=hingeR]'),
      hingeL: q<SVGPathElement>('[data-m=hingeL]'),
      dimA: q<SVGPathElement>('[data-m=dimA]'),
      dimB: q<SVGPathElement>('[data-m=dimB]'),
      dimD: q<SVGPathElement>('[data-m=dimD]'),
      textA: q<SVGTextElement>('[data-m=textA]'),
      textB: q<SVGTextElement>('[data-m=textB]'),
      textD: q<SVGTextElement>('[data-m=textD]'),
    }
    const paint = (g: Geo) => {
      const d = draw(g)
      for (const k of ['lensR', 'lensL', 'bridge', 'hingeR', 'hingeL', 'dimA', 'dimB', 'dimD'] as const) els[k].setAttribute('d', d[k])
      for (const k of ['textA', 'textB', 'textD'] as const) {
        els[k].setAttribute('x', f(d[k].x))
        els[k].setAttribute('y', f(d[k].y))
        els[k].textContent = String(d[k].v)
      }
      svg.style.setProperty('--rim', f(g.rim))
    }
    const t0 = performance.now()
    const dur = reduce ? 0 : 900
    let raf = 0
    const step = (now: number) => {
      const p = dur ? Math.min(1, (now - t0) / dur) : 1
      const e = 1 - Math.pow(1 - p, 4)
      lerpGeo(from, to, e, live)
      cur.current = live
      paint(live)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [active, geos])

  // auto-play while on screen and nobody is pointing at a shape
  useEffect(() => {
    if (hovering || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = sectionRef.current!
    let visible = false
    const io = new IntersectionObserver(([en]) => (visible = !!en?.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    const id = window.setInterval(() => {
      if (visible && !document.hidden) setActive((i) => (i + 1) % shapes.length)
    }, 2600)
    return () => {
      io.disconnect()
      window.clearInterval(id)
    }
  }, [hovering, shapes.length])

  const s = shapes[active]!
  const longest = shapes.reduce((a, x) => (x.intro.length > a.length ? x.intro : a), '')
  return (
    <section ref={sectionRef} aria-labelledby="forme" className="container-x py-24">
      <div className="mb-10 max-w-3xl md:mb-12">
        <div className="eyebrow mb-3">Rame de vedere</div>
        <h2 id="forme" className="disp focus-reveal text-[clamp(34px,4.6vw,60px)]">
          Caută după <em>formă.</em>
        </h2>
        <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-ink-2">Forma ramei schimbă proporțiile feței mai mult decât culoarea. Treci peste o formă și uite cum se schimbă rama — cu cotele ei reale.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-14">
        <div className="morph-stage relative overflow-hidden rounded-[32px] bg-glass ring-1 ring-line-soft ring-inset">
          <div className="pointer-events-none absolute inset-x-6 top-6 flex items-start justify-between gap-4 sm:inset-x-8 sm:top-8">
            <div key={s.value} className="morph-name disp text-[clamp(44px,6vw,96px)] leading-[0.9]">
              {s.plural}
            </div>
            <div className="spec shrink-0 pt-2 text-right">
              {String(active + 1).padStart(2, '0')} / {String(shapes.length).padStart(2, '0')}
            </div>
          </div>
          <svg ref={svgRef} viewBox={box} className="morph-svg relative mx-auto mt-[clamp(96px,14vw,150px)] block h-auto w-[86%]" aria-hidden>
            <path data-m="lensR" d={initial.lensR} className="morph-lens" />
            <path data-m="lensL" d={initial.lensL} className="morph-lens" />
            <path data-m="bridge" d={initial.bridge} className="morph-rim" />
            <path data-m="hingeR" d={initial.hingeR} className="morph-rim" />
            <path data-m="hingeL" d={initial.hingeL} className="morph-rim" />
            <path data-m="dimA" d={initial.dimA} className="morph-dim" />
            <path data-m="dimB" d={initial.dimB} className="morph-dim" />
            <path data-m="dimD" d={initial.dimD} className="morph-dim" />
            <text data-m="textA" x={initial.textA.x} y={initial.textA.y} textAnchor="middle" className="morph-num">
              {initial.textA.v}
            </text>
            <text data-m="textB" x={initial.textB.x} y={initial.textB.y} className="morph-num">
              {initial.textB.v}
            </text>
            <text data-m="textD" x={initial.textD.x} y={initial.textD.y} textAnchor="middle" className="morph-num">
              {initial.textD.v}
            </text>
          </svg>
          <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
            {/* the longest note reserves the height, so auto-play never shifts the page */}
            <div className="grid max-w-md">
              <p aria-hidden className="invisible col-start-1 row-start-1 text-[15px] leading-relaxed">
                {longest} Cotele: {s.example.name}.
              </p>
              <p key={s.value} className="morph-intro col-start-1 row-start-1 text-[15px] leading-relaxed text-ink-2">
                {s.intro}{' '}
                <span className="text-graphite">
                  Cotele: <Link href={s.example.href}>{s.example.name}</Link>.
                </span>
              </p>
            </div>
            <Link href={s.href} className="btn btn-ink btn-sm shrink-0 self-start sm:self-auto">
              Vezi {s.count} {s.count === 1 ? 'ramă' : 'rame'}
              <Icon name="arrow-right" size={16} />
            </Link>
          </div>
        </div>

        <ul className="morph-list" onPointerLeave={() => setHovering(false)}>
          {shapes.map((sh, i) => (
            <li key={sh.value}>
              <Link
                href={sh.href}
                data-on={i === active ? '' : undefined}
                onPointerEnter={() => {
                  setHovering(true)
                  setActive(i)
                }}
                onFocus={() => {
                  setHovering(true)
                  setActive(i)
                }}
                onBlur={() => setHovering(false)}
                className="morph-row"
              >
                <span className="morph-row-name">{sh.plural}</span>
                <span className="spec">{sh.count}</span>
                <Icon name="arrow-up-right" size={18} className="morph-row-arrow" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
