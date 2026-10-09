/**
 * Procedural eyewear renderer.
 *
 * Every frame in the catalogue is described by its real measurements
 * (lens width A, lens height B, bridge DBL — mm) plus a handful of shape
 * parameters. From that we draw a true-to-scale front view as SVG:
 * 1 SVG unit = 1 mm. The same drawing powers product cards, the 3D hero,
 * the configurator, OG images and the virtual try-on (where mm → px comes
 * from the iris diameter, so frames appear at their real size on your face).
 *
 * Output is a tiny framework-agnostic node tree → React or string.
 */
import type { FrameGeometry, Swatch } from './db/schema'

export type Shape = 'rectangular' | 'square' | 'round' | 'oval' | 'cat-eye' | 'pilot' | 'browline' | 'geometric'
export type Rim = 'full' | 'semi' | 'rimless'
export type Material = 'acetat' | 'metal' | 'titan' | 'tr90' | 'combinat'

export type FrameSpec = {
  shape: Shape
  lensWidth: number
  lensHeight: number
  bridgeWidth: number
  rim: Rim
  material: Material
  geometry: FrameGeometry
  category?: 'optical' | 'sun'
}

export type Pt = [number, number]

export type SvgNode = { t: string; a?: Record<string, string | number | undefined>; c?: SvgNode[]; text?: string }

/* ──────────────────────────────────────────────────────────────────────────
   Lens outline
   ────────────────────────────────────────────────────────────────────────── */

const TENSION: Record<Shape, [top: number, bottom: number]> = {
  rectangular: [3.7, 3.1],
  square: [4.8, 4.1],
  round: [2, 2],
  oval: [2.15, 2.05],
  'cat-eye': [3.2, 2.4],
  pilot: [3.8, 2.05],
  browline: [5.2, 2.5],
  geometric: [2, 2],
}

const sgn = (v: number) => (v < 0 ? -1 : 1)

/**
 * Outline of the screen-right lens, centred at (0,0).
 * +x = temporal (outer) side, −x = nasal side, +y = down (SVG).
 */
export function lensOutline(spec: Pick<FrameSpec, 'shape' | 'lensWidth' | 'lensHeight' | 'geometry'>, samples = 144): Pt[] {
  const a = spec.lensWidth / 2
  const b = spec.lensHeight / 2
  const shape = spec.shape
  let pts: Pt[]

  if (shape === 'geometric') {
    // Flat-top hexagon, slightly wider at the top, rounded with Chaikin smoothing.
    const raw: Pt[] = [
      [1, -0.08],
      [0.56, -1],
      [-0.58, -1],
      [-1, -0.1],
      [-0.6, 1],
      [0.52, 1],
    ]
    pts = densify(chaikin(raw.map(([u, v]) => [u * a, v * b] as Pt), 3), 2)
  } else {
    const [nTop, nBot] = spec.geometry.tension ? [spec.geometry.tension, spec.geometry.tension * 0.88] : TENSION[shape]
    const lift = spec.geometry.lift ?? (shape === 'cat-eye' ? 0.55 : shape === 'pilot' ? 0.6 : 0)
    pts = []
    for (let i = 0; i < samples; i++) {
      const t = (i / samples) * Math.PI * 2
      const c = Math.cos(t)
      const s = Math.sin(t)
      const n = s < 0 ? nTop : nBot
      let x = a * sgn(c) * Math.abs(c) ** (2 / n)
      let y = b * sgn(s) * Math.abs(s) ** (2 / n)
      const u = x / a
      const v = y / b

      if (shape !== 'round' && shape !== 'pilot') {
        // Real lenses are cut narrower at the nasal-bottom to clear the nose.
        if (u < 0 && v > 0) x *= 1 - 0.13 * v ** 1.6 * (-u) ** 1.2
        // …and very slightly narrower at the bottom overall.
        x *= 1 - 0.035 * Math.max(0, v)
      }
      if (shape === 'cat-eye') {
        if (v < 0) {
          // the brow line climbs steadily towards the temple and flicks up at the corner
          const climb = 0.3 * ((u + 1) / 2) ** 1.5 + 0.6 * Math.max(0, u) ** 4
          y -= lift * b * climb * (-v) ** 0.5
          if (u > 0) x += lift * a * 0.08 * u ** 2 * (-v) ** 0.8
        } else if (u > 0) {
          // outer-bottom sweeps up towards the corner
          y *= 1 - 0.36 * lift * u ** 1.8
        }
      }
      if (shape === 'pilot') {
        // teardrop: flat brow, bottom drops towards the nose
        if (v > 0) y *= 1 + lift * 0.55 * ((1 - u) / 2) ** 1.3
        if (v > 0 && u > 0) y *= 1 - 0.18 * lift * u ** 2
        if (v < 0) y *= 0.9
      }
      pts.push([x, y])
    }
  }
  return fitBox(pts, a, b)
}

function densify(pts: Pt[], k: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    const q = pts[(i + 1) % pts.length]!
    for (let j = 0; j < k; j++) out.push([p[0] + ((q[0] - p[0]) * j) / k, p[1] + ((q[1] - p[1]) * j) / k])
  }
  return out
}

function chaikin(pts: Pt[], iterations: number): Pt[] {
  let out = pts
  for (let k = 0; k < iterations; k++) {
    const next: Pt[] = []
    for (let i = 0; i < out.length; i++) {
      const p = out[i]!
      const q = out[(i + 1) % out.length]!
      next.push([0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]])
      next.push([0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]])
    }
    out = next
  }
  return out
}

/** Rescale so the outline's bounding box is exactly A × B (the catalogue numbers). */
function fitBox(pts: Pt[], a: number, b: number): Pt[] {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity
  for (const [x, y] of pts) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const sx = (2 * a) / (maxX - minX)
  const sy = (2 * b) / (maxY - minY)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  return pts.map(([x, y]) => [(x - cx) * sx, (y - cy) * sy])
}

const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

export function pathFromPoints(pts: Pt[], closed = true): string {
  if (!pts.length) return ''
  const [x0, y0] = pts[0]!
  let d = `M${f1(x0)} ${f1(y0)}`
  for (let i = 1; i < pts.length; i++) d += `L${f1(pts[i]![0])} ${f1(pts[i]![1])}`
  return closed ? `${d}Z` : d
}

/** x of the outline on the nasal (side=-1) or temporal (side=1) edge at height y. */
export function edgeXAt(pts: Pt[], y: number, side: -1 | 1): number {
  let best = 0
  let bestDist = Infinity
  for (const [px, py] of pts) {
    if (sgn(px) !== side) continue
    const d = Math.abs(py - y)
    if (d < bestDist) {
      bestDist = d
      best = px
    }
  }
  return best
}

export function topYAt(pts: Pt[], x: number): number {
  let best = 0
  let bestDist = Infinity
  for (const [px, py] of pts) {
    if (py > 0) continue
    const d = Math.abs(px - x)
    if (d < bestDist) {
      bestDist = d
      best = py
    }
  }
  return best
}

/* ──────────────────────────────────────────────────────────────────────────
   Frame layout (positions of lenses, bridge, hinges) — mm
   ────────────────────────────────────────────────────────────────────────── */

export type FrameLayout = {
  outline: Pt[]
  cx: number
  a: number
  b: number
  rimW: number
  bridgeY: number
  bridgeX: number
  hingeY: number
  hingeX: number
  viewBox: [number, number, number, number]
  totalWidth: number
}

export function frameLayout(spec: FrameSpec): FrameLayout {
  const outline = lensOutline(spec)
  const a = spec.lensWidth / 2
  const b = spec.lensHeight / 2
  const cx = spec.bridgeWidth / 2 + a
  const rimW = rimWidth(spec)
  const bridgeY = spec.shape === 'pilot' ? -b * 0.35 : spec.shape === 'round' ? -b * 0.2 : -b * 0.32
  const bridgeX = cx + edgeXAt(outline, bridgeY, -1) // x where bridge meets the right lens (≈ DBL/2)
  const hingeY = spec.shape === 'cat-eye' ? -b * 0.8 : spec.shape === 'pilot' ? -b * 0.7 : -b * 0.48
  const hingeX = cx + edgeXAt(outline, hingeY, 1)
  const pad = 9
  const halfW = hingeX + 6 + pad
  const top = -b - rimW - (spec.shape === 'cat-eye' ? 4 : 2) - (spec.geometry.bridgeStyle === 'double' ? 4 : 0) - 3
  const bottom = b * (spec.shape === 'pilot' ? 1.05 : 1) + rimW + 5
  return {
    outline,
    cx,
    a,
    b,
    rimW,
    bridgeY,
    bridgeX,
    hingeY,
    hingeX,
    viewBox: [-halfW, top, halfW * 2, bottom - top],
    totalWidth: (hingeX + 4) * 2,
  }
}

function rimWidth(spec: FrameSpec): number {
  const g = spec.geometry.rim
  if (spec.rim === 'rimless') return 0.5
  if (g) return g
  return spec.material === 'metal' || spec.material === 'titan' ? 1.3 : 4.6
}

/* ──────────────────────────────────────────────────────────────────────────
   Paint (materials & finishes)
   ────────────────────────────────────────────────────────────────────────── */

function hash(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

function mulberry(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const METAL: Record<string, [string, string, string]> = {
  gold: ['#F1DFAE', '#C59B4E', '#7E5F2A'],
  silver: ['#F4F6F7', '#AEB6BC', '#5E676E'],
  gunmetal: ['#9AA1A7', '#4D545A', '#1F2428'],
  black: ['#5C6268', '#22272B', '#0B0E11'],
  rose: ['#F6D7CB', '#C98F7B', '#87563F'],
}

function metalStops(color: string): [string, string, string] {
  return METAL[color] ?? [lighten(color, 0.55), color, darken(color, 0.45)]
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]
}
const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')}`
export function lighten(hex: string, k: number) {
  if (!hex.startsWith('#')) return hex
  const [r, g, b] = hexToRgb(hex)
  return toHex(r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k)
}
export function darken(hex: string, k: number) {
  if (!hex.startsWith('#')) return hex
  const [r, g, b] = hexToRgb(hex)
  return toHex(r * (1 - k), g * (1 - k), b * (1 - k))
}

/* ──────────────────────────────────────────────────────────────────────────
   Node tree
   ────────────────────────────────────────────────────────────────────────── */

export type FrameRenderOptions = {
  /** 'full' (default) | 'rim' — flat silhouette used for 3D extrusion layers */
  mode?: 'full' | 'rim'
  /** Flat colour for mode 'rim' */
  rimColor?: string
  /** Soft contact shadow below the frame */
  shadow?: boolean
  /** Show temples stubs */
  temples?: boolean
  /** Extra id salt when the same frame is drawn multiple times with different options */
  idSalt?: string
  /** Accessible title */
  title?: string
  /** Lens glass visible (default true) */
  glass?: boolean
  /** Override viewBox (e.g. shared scale across a grid) */
  viewBox?: [number, number, number, number]
}

export function buildFrameSvg(spec: FrameSpec, swatch: Swatch, opts: FrameRenderOptions = {}): SvgNode {
  const L = frameLayout(spec)
  const id = `fr${hash(JSON.stringify([spec, swatch, opts.mode, opts.idSalt]))}`
  const defs: SvgNode[] = []
  const lensPathId = `${id}l`
  const lensD = pathFromPoints(L.outline)
  defs.push({ t: 'path', a: { id: lensPathId, d: lensD } })

  const isMetal = swatch.kind === 'metal' || spec.material === 'metal' || spec.material === 'titan'
  const flat = opts.mode === 'rim'
  const isSun = spec.category === 'sun' || !!swatch.lens

  // ── paint for rims
  let rimPaint = swatch.primary
  let rimOpacity = 1
  if (!flat) {
    if (swatch.kind === 'havana') {
      const pid = `${id}h`
      rimPaint = `url(#${pid})`
      const rnd = mulberry(parseInt(hash(swatch.primary + (swatch.secondary ?? '')), 36))
      const spots: SvgNode[] = []
      const base = swatch.primary
      const light = swatch.secondary ?? '#B07A3E'
      const deep = darken(base, 0.55)
      const gl = `${id}hg1`
      const gd = `${id}hg2`
      defs.push(
        { t: 'radialGradient', a: { id: gl }, c: [stop(0, light, 0.95), stop(0.7, light, 0.35), stop(1, light, 0)] },
        { t: 'radialGradient', a: { id: gd }, c: [stop(0, deep, 0.9), stop(1, deep, 0)] },
      )
      for (let i = 0; i < 14; i++) {
        spots.push({
          t: 'ellipse',
          a: {
            cx: f1(rnd() * 18),
            cy: f1(rnd() * 18),
            rx: f1(1.6 + rnd() * 3.4),
            ry: f1(1 + rnd() * 2.2),
            fill: `url(#${i % 3 === 0 ? gd : gl})`,
            transform: `rotate(${Math.round(rnd() * 180)} 9 9)`,
          },
        })
      }
      defs.push({
        t: 'pattern',
        a: { id: pid, width: 18, height: 18, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(-18)' },
        c: [{ t: 'rect', a: { width: 18, height: 18, fill: base } }, ...spots],
      })
    } else if (isMetal) {
      const gid = `${id}m`
      const [hi, mid, lo] = metalStops(swatch.kind === 'metal' ? swatch.primary : (swatch.secondary ?? 'gunmetal'))
      defs.push({
        t: 'linearGradient',
        a: { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 },
        c: [stop(0, hi), stop(0.45, mid), stop(1, lo)],
      })
      rimPaint = `url(#${gid})`
    } else if (swatch.kind === 'gradient') {
      const gid = `${id}g`
      defs.push({
        t: 'linearGradient',
        a: { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 },
        c: [stop(0, swatch.primary), stop(1, swatch.secondary ?? lighten(swatch.primary, 0.6))],
      })
      rimPaint = `url(#${gid})`
    } else if (swatch.kind === 'crystal') {
      rimOpacity = 0.62
    }
  } else {
    rimPaint = opts.rimColor ?? '#161B20'
  }

  const right = `translate(${f1(L.cx)} 0)`
  const left = `translate(${f1(-L.cx)} 0) scale(-1 1)`
  const g: SvgNode[] = []

  // ── shadow
  if (opts.shadow && !flat) {
    const sid = `${id}s`
    defs.push({ t: 'radialGradient', a: { id: sid }, c: [stop(0, '#0D1216', 0.22), stop(1, '#0D1216', 0)] })
    g.push({ t: 'ellipse', a: { cx: 0, cy: f1(L.b + L.rimW + 3.2), rx: f1(L.hingeX * 0.92), ry: 2.6, fill: `url(#${sid})` } })
  }

  // ── lens glass
  if (!flat && opts.glass !== false) {
    const glassId = `${id}gl`
    const specId = `${id}sp`
    const clipId = `${id}c`
    if (isSun) {
      const tint = swatch.lens ?? '#2B2F33'
      defs.push({
        t: 'linearGradient',
        a: { id: glassId, x1: 0, y1: 0, x2: 0, y2: 1 },
        c: swatch.lensGradient ? [stop(0, darken(tint, 0.25), 0.96), stop(1, lighten(tint, 0.35), 0.5)] : [stop(0, darken(tint, 0.1), 0.92), stop(1, tint, 0.86)],
      })
    } else {
      defs.push({
        t: 'linearGradient',
        a: { id: glassId, x1: 0, y1: 0, x2: 0.3, y2: 1 },
        c: [stop(0, '#FFFFFF', 0.42), stop(0.55, '#E9EEF2', 0.16), stop(1, '#5A6FE0', 0.1)],
      })
    }
    defs.push({
      t: 'linearGradient',
      a: { id: specId, x1: 0, y1: 0, x2: 1, y2: 0 },
      c: [stop(0, '#FFFFFF', 0), stop(0.5, '#FFFFFF', isSun ? 0.32 : 0.75), stop(1, '#FFFFFF', 0)],
    })
    defs.push({ t: 'clipPath', a: { id: clipId }, c: [{ t: 'use', a: { href: `#${lensPathId}`, transform: right } }, { t: 'use', a: { href: `#${lensPathId}`, transform: left } }] })
    g.push({ t: 'use', a: { href: `#${lensPathId}`, transform: right, fill: `url(#${glassId})` } })
    g.push({ t: 'use', a: { href: `#${lensPathId}`, transform: left, fill: `url(#${glassId})` } })
    if (swatch.mirror) {
      const mid = `${id}mr`
      defs.push({
        t: 'linearGradient',
        a: { id: mid, x1: 0, y1: 0, x2: 1, y2: 1 },
        c: [stop(0, swatch.mirror, 0.75), stop(0.5, lighten(swatch.mirror, 0.5), 0.35), stop(1, swatch.mirror, 0.7)],
      })
      g.push({ t: 'g', a: { 'clip-path': `url(#${clipId})` }, c: [{ t: 'rect', a: { x: f1(-L.cx - L.a), y: f1(-L.b), width: f1((L.cx + L.a) * 2), height: f1(L.b * 2.2), fill: `url(#${mid})` } }] })
    }
    // specular streaks (the hero animates these through CSS var --spec)
    g.push({
      t: 'g',
      a: { 'clip-path': `url(#${clipId})` },
      c: [
        {
          t: 'g',
          a: { class: 'fr-spec' },
          c: [
            { t: 'rect', a: { x: f1(-L.cx - L.a * 0.55), y: f1(-L.b * 1.6), width: f1(L.a * 0.42), height: f1(L.b * 3.2), fill: `url(#${specId})`, transform: 'skewX(-18)' } },
            { t: 'rect', a: { x: f1(-L.cx + L.a * 0.05), y: f1(-L.b * 1.6), width: f1(L.a * 0.12), height: f1(L.b * 3.2), fill: `url(#${specId})`, opacity: 0.6, transform: 'skewX(-18)' } },
            { t: 'rect', a: { x: f1(L.cx - L.a * 0.45), y: f1(-L.b * 1.6), width: f1(L.a * 0.34), height: f1(L.b * 3.2), fill: `url(#${specId})`, opacity: 0.85, transform: 'skewX(-18)' } },
          ],
        },
      ],
    })
  }

  // ── rims
  const rimStroke = { fill: 'none', stroke: rimPaint, 'stroke-width': f1(L.rimW), 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-opacity': rimOpacity === 1 ? undefined : rimOpacity }
  const topArc = (pts: Pt[], thr = L.b * 0.18) => {
    // contiguous run of outline points above `thr`, walking out from the topmost point
    let top = 0
    pts.forEach(([, y], i) => {
      if (y < pts[top]![1]) top = i
    })
    const n = pts.length
    let start = top
    let end = top
    while (pts[(start - 1 + n) % n]![1] < thr && (start - 1 + n) % n !== top) start = (start - 1 + n) % n
    while (pts[(end + 1) % n]![1] < thr && (end + 1) % n !== start) end = (end + 1) % n
    const arc: Pt[] = []
    for (let i = start; ; i = (i + 1) % n) {
      arc.push(pts[i]!)
      if (i === end) break
    }
    return arc
  }

  if (spec.rim === 'full' && spec.shape !== 'browline') {
    if (!flat && swatch.kind === 'crystal') {
      const edge = { ...rimStroke, stroke: darken(swatch.primary, 0.28), 'stroke-opacity': 0.75 }
      const core = { ...rimStroke, stroke: lighten(swatch.primary, 0.35), 'stroke-opacity': 0.8, 'stroke-width': f1(L.rimW * 0.62) }
      g.push({ t: 'use', a: { href: `#${lensPathId}`, transform: right, ...edge } }, { t: 'use', a: { href: `#${lensPathId}`, transform: left, ...edge } })
      g.push({ t: 'use', a: { href: `#${lensPathId}`, transform: right, ...core } }, { t: 'use', a: { href: `#${lensPathId}`, transform: left, ...core } })
    } else {
      g.push({ t: 'use', a: { href: `#${lensPathId}`, transform: right, ...rimStroke } })
      g.push({ t: 'use', a: { href: `#${lensPathId}`, transform: left, ...rimStroke } })
    }
  } else if (spec.shape === 'browline' || spec.rim === 'semi') {
    const arcD = pathFromPoints(topArc(L.outline), false)
    const browW = spec.shape === 'browline' ? L.rimW * (spec.geometry.browWeight ?? 1.5) : L.rimW
    if (spec.shape === 'browline' && !flat) {
      // thin metal rim under the acetate brow
      const mid = `${id}bm`
      const [hi, m, lo] = metalStops(swatch.secondary ?? 'gold')
      defs.push({ t: 'linearGradient', a: { id: mid, x1: 0, y1: 0, x2: 0, y2: 1 }, c: [stop(0, hi), stop(0.5, m), stop(1, lo)] })
      g.push({ t: 'use', a: { href: `#${lensPathId}`, transform: right, fill: 'none', stroke: `url(#${mid})`, 'stroke-width': 1.1 } })
      g.push({ t: 'use', a: { href: `#${lensPathId}`, transform: left, fill: 'none', stroke: `url(#${mid})`, 'stroke-width': 1.1 } })
    } else if (!flat) {
      // nylon line / lens edge
      g.push({ t: 'use', a: { href: `#${lensPathId}`, transform: right, fill: 'none', stroke: '#0D1216', 'stroke-opacity': 0.22, 'stroke-width': 0.45 } })
      g.push({ t: 'use', a: { href: `#${lensPathId}`, transform: left, fill: 'none', stroke: '#0D1216', 'stroke-opacity': 0.22, 'stroke-width': 0.45 } })
    }
    const arcPathId = `${id}a`
    defs.push({ t: 'path', a: { id: arcPathId, d: arcD } })
    const browStroke = { ...rimStroke, 'stroke-width': f1(browW) }
    g.push({ t: 'use', a: { href: `#${arcPathId}`, transform: `${right} translate(0 ${f1(-browW * 0.18)})`, ...browStroke } })
    g.push({ t: 'use', a: { href: `#${arcPathId}`, transform: `${left} translate(0 ${f1(-browW * 0.18)})`, ...browStroke } })
  } else {
    // rimless: subtle edge
    if (!flat) {
      g.push({ t: 'use', a: { href: `#${lensPathId}`, transform: right, fill: 'none', stroke: '#0D1216', 'stroke-opacity': 0.3, 'stroke-width': 0.5 } })
      g.push({ t: 'use', a: { href: `#${lensPathId}`, transform: left, fill: 'none', stroke: '#0D1216', 'stroke-opacity': 0.3, 'stroke-width': 0.5 } })
    }
  }

  // ── gloss highlight on acetate rims
  if (!flat && !isMetal && spec.rim !== 'rimless' && spec.shape !== 'browline') {
    const hl = { fill: 'none', stroke: '#FFFFFF', 'stroke-opacity': swatch.kind === 'crystal' ? 0.5 : 0.28, 'stroke-width': f1(Math.max(0.35, L.rimW * 0.16)), 'stroke-linecap': 'round' }
    const arcHl = pathFromPoints(topArc(L.outline, -L.b * 0.55).filter(([x]) => Math.abs(x) < L.a * 0.8), false)
    const hlId = `${id}hl`
    defs.push({ t: 'path', a: { id: hlId, d: arcHl } })
    const lift = -L.rimW * 0.22
    g.push({ t: 'use', a: { href: `#${hlId}`, transform: `${right} translate(0 ${f1(lift)})`, ...hl } })
    g.push({ t: 'use', a: { href: `#${hlId}`, transform: `${left} translate(0 ${f1(lift)})`, ...hl } })
  }

  // ── bridge
  const bx = L.bridgeX - (spec.rim === 'rimless' ? 0 : L.rimW * 0.15)
  const by = L.bridgeY
  const bridgeW = isMetal || spec.rim === 'rimless' ? Math.max(1.3, L.rimW) : L.rimW * 0.92
  const style = spec.geometry.bridgeStyle
  const archH = style === 'keyhole' ? Math.max(3.2, spec.bridgeWidth * 0.26) : style === 'straight' ? 0.6 : Math.max(2.2, spec.bridgeWidth * 0.18)
  const bridgeD = `M${f1(-bx - 0.5)} ${f1(by)}C${f1(-bx * 0.45)} ${f1(by - archH)} ${f1(bx * 0.45)} ${f1(by - archH)} ${f1(bx + 0.5)} ${f1(by)}`
  g.push({ t: 'path', a: { d: bridgeD, fill: 'none', stroke: rimPaint, 'stroke-width': f1(bridgeW), 'stroke-linecap': 'round', 'stroke-opacity': rimOpacity === 1 ? undefined : rimOpacity } })
  if (style === 'double') {
    const topY = Math.min(topYAt(L.outline, -L.a * 0.55), -L.b * 0.9) - L.rimW * 0.4
    const x1 = L.cx - L.a * 0.55
    g.push({
      t: 'path',
      a: {
        d: `M${f1(-x1)} ${f1(topY)}C${f1(-x1 * 0.35)} ${f1(topY - 1.6)} ${f1(x1 * 0.35)} ${f1(topY - 1.6)} ${f1(x1)} ${f1(topY)}`,
        fill: 'none',
        stroke: rimPaint,
        'stroke-width': f1(Math.max(1.1, L.rimW * 0.85)),
        'stroke-linecap': 'round',
      },
    })
  }
  if (spec.rim === 'rimless' && !flat) {
    // drill mounts
    for (const s of [1, -1]) {
      g.push({ t: 'rect', a: { x: f1(s * (L.bridgeX + 1.5) - 1.2), y: f1(by - 1.4), width: 2.4, height: 2.8, rx: 0.6, fill: rimPaint } })
    }
  }

  // ── nose pads (metal)
  if (!flat && (spec.geometry.pads ?? isMetal)) {
    for (const s of [1, -1]) {
      const px = s * (spec.bridgeWidth / 2 + 1.1)
      g.push({ t: 'path', a: { d: `M${f1(s * (bx - 0.2))} ${f1(by + 0.6)}Q${f1(px + s * 0.4)} ${f1(by + 3)} ${f1(px)} ${f1(by + 5.2)}`, fill: 'none', stroke: rimPaint, 'stroke-width': 0.5 } })
      g.push({ t: 'ellipse', a: { cx: f1(px), cy: f1(by + 8), rx: 1.7, ry: 3.1, fill: '#FFFFFF', 'fill-opacity': 0.5, stroke: '#0D1216', 'stroke-opacity': 0.25, 'stroke-width': 0.3, transform: `rotate(${s * 12} ${f1(px)} ${f1(by + 8)})` } })
    }
  }

  // ── hinges / endpieces (+ temple stubs)
  const hingeH = Math.max(2.4, L.rimW * (isMetal ? 2 : 1.05))
  for (const s of [1, -1]) {
    const x0 = s * (L.hingeX - (spec.rim === 'rimless' ? 0 : L.rimW * 0.3))
    const w = 5.2
    const xLeft = s > 0 ? x0 : x0 - w
    g.push({ t: 'rect', a: { x: f1(xLeft), y: f1(L.hingeY - hingeH / 2), width: w, height: f1(hingeH), rx: f1(Math.min(1.6, hingeH / 2)), fill: rimPaint, 'fill-opacity': rimOpacity === 1 ? undefined : rimOpacity } })
    if (!flat) {
      g.push({ t: 'circle', a: { cx: f1(xLeft + w / 2), cy: f1(L.hingeY), r: 0.55, fill: '#C9D1D6' } })
      if (opts.temples !== false) {
        const tColor =
          swatch.temple ??
          (isMetal ? metalStops(swatch.kind === 'metal' ? swatch.primary : (swatch.secondary ?? 'gunmetal'))[1] : rimPaint.startsWith('url') ? darken(swatch.primary, 0.1) : rimPaint)
        g.push({ t: 'rect', a: { x: f1(s > 0 ? xLeft + w - 0.4 : xLeft - 2.6), y: f1(L.hingeY - hingeH * 0.36), width: 3, height: f1(hingeH * 0.72), rx: 0.6, fill: tColor, opacity: 0.92 } })
      }
    }
  }

  const vb = opts.viewBox ?? L.viewBox
  const children: SvgNode[] = []
  if (opts.title) children.push({ t: 'title', text: opts.title })
  children.push({ t: 'defs', c: defs }, { t: 'g', c: g })
  return {
    t: 'svg',
    a: {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: vb.map(f1).join(' '),
      role: opts.title ? 'img' : undefined,
      'aria-hidden': opts.title ? undefined : 'true',
    },
    c: children,
  }
}

function stop(offset: number, color: string, opacity?: number): SvgNode {
  return { t: 'stop', a: { offset, 'stop-color': color, 'stop-opacity': opacity } }
}

/* ──────────────────────────────────────────────────────────────────────────
   Serialisation
   ────────────────────────────────────────────────────────────────────────── */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function svgToString(node: SvgNode): string {
  const attrs = Object.entries(node.a ?? {})
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${esc(String(v))}"`)
    .join('')
  const inner = (node.text ? esc(node.text) : '') + (node.c ?? []).map(svgToString).join('')
  return `<${node.t}${attrs}>${inner}</${node.t}>`
}

export function frameSvgString(spec: FrameSpec, swatch: Swatch, opts?: FrameRenderOptions) {
  return svgToString(buildFrameSvg(spec, swatch, opts))
}

export function frameDataUri(spec: FrameSpec, swatch: Swatch, opts?: FrameRenderOptions) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(frameSvgString(spec, swatch, opts))}`
}
