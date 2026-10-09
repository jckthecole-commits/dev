/**
 * Real 3D eyewear, built from the same catalogue measurements as the SVG
 * renderer (1 unit = 1 mm). Front rims are extruded and bevelled, metal is
 * swept as wire, temples follow a side profile with the ear bend, and the
 * whole front gets a gentle face-form wrap. Client-only (imports three).
 */
import * as THREE from 'three'
import type { Swatch } from '@/lib/db/schema'
import { frameLayout, lighten, darken, type FrameSpec, type Pt } from '@/lib/frame-geometry'

export type FrameParts = {
  root: THREE.Group
  front: THREE.Group
  lensR: THREE.Mesh
  lensL: THREE.Mesh
  hingeR: THREE.Group
  hingeL: THREE.Group
  templeR: THREE.Group
  templeL: THREE.Group
  pads: THREE.Group | null
  /** anchor points (local to root) for callouts */
  anchors: { rim: THREE.Vector3; lens: THREE.Vector3; bridge: THREE.Vector3; hinge: THREE.Vector3; temple: THREE.Vector3 }
  size: { width: number; height: number; depth: number }
}

export type LensMode = 'glass' | 'custom'

const METAL: Record<string, string> = { gold: '#D8B46A', silver: '#C9CFD4', gunmetal: '#5B6268', black: '#2A2F34', rose: '#D9A08A' }
const WRAP_R = 260 // face-form wrap radius (mm)

/* ── geometry helpers ─────────────────────────────────────────────────── */

const toV2 = ([x, y]: Pt) => new THREE.Vector2(x, -y) // SVG y-down → three y-up

/** Offset a closed outline outward by d (mm). */
function offsetOutline(pts: Pt[], d: number): Pt[] {
  const n = pts.length
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n]!
    const b = pts[(i + 1) % n]!
    let nx = b[1] - a[1]
    let ny = -(b[0] - a[0])
    const len = Math.hypot(nx, ny) || 1
    nx /= len
    ny /= len
    if (nx * p[0] + ny * p[1] < 0) {
      nx = -nx
      ny = -ny
    }
    return [p[0] + nx * d, p[1] + ny * d] as Pt
  })
}

/** Resample a closed outline to n points (keeps tubes and extrusions light). */
function resample(pts: Pt[], n: number): Pt[] {
  const seg: number[] = [0]
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i - 1]!
    const b = pts[i % pts.length]!
    seg.push(seg[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const total = seg[seg.length - 1]!
  const out: Pt[] = []
  let j = 0
  for (let k = 0; k < n; k++) {
    const t = (k / n) * total
    while (seg[j + 1]! < t) j++
    const a = pts[j % pts.length]!
    const b = pts[(j + 1) % pts.length]!
    const f = (t - seg[j]!) / (seg[j + 1]! - seg[j]! || 1)
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f])
  }
  return out
}

/** Bend geometry around a vertical cylinder (face form) — temples excluded. */
function wrap(geo: THREE.BufferGeometry, offsetX = 0) {
  const pos = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + offsetX
    pos.setZ(i, pos.getZ(i) - (x * x) / (2 * WRAP_R))
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
}

/** Lens base curve: a gentle spherical bulge around the lens centre. */
function bulge(geo: THREE.BufferGeometry, r = 140) {
  const pos = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    pos.setZ(i, pos.getZ(i) - (x * x + y * y) / (2 * r))
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
}

function extrude(shape: THREE.Shape, depth: number, bevel: number) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.85, bevelSegments: 3, curveSegments: 6, steps: 1 })
  g.translate(0, 0, -depth / 2)
  return g
}

function tube(points: THREE.Vector3[], radius: number, closed: boolean, segments = 160) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal')
  return new THREE.TubeGeometry(curve, segments, radius, 10, closed)
}

/** Band polygon around a 2D polyline (for bridges and brows). */
function band(path: Pt[], w0: number, w1 = w0): THREE.Shape {
  const left: Pt[] = []
  const right: Pt[] = []
  for (let i = 0; i < path.length; i++) {
    const a = path[Math.max(0, i - 1)]!
    const b = path[Math.min(path.length - 1, i + 1)]!
    let nx = -(b[1] - a[1])
    let ny = b[0] - a[0]
    const l = Math.hypot(nx, ny) || 1
    nx /= l
    ny /= l
    const w = (w0 + (w1 - w0) * (i / (path.length - 1))) / 2
    const p = path[i]!
    left.push([p[0] + nx * w, p[1] + ny * w])
    right.push([p[0] - nx * w, p[1] - ny * w])
  }
  const ring = [...left, ...right.reverse()]
  return new THREE.Shape(ring.map(toV2))
}

function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 24): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const u = 1 - t
    out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]])
  }
  return out
}

/* ── materials ────────────────────────────────────────────────────────── */

const textureCache = new Map<string, THREE.Texture>()

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Procedural tortoiseshell: layered soft blobs in amber and near-black. */
function havanaTexture(base: string, light: string): THREE.Texture {
  const key = `h${base}${light}`
  const hit = textureCache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = base
  g.fillRect(0, 0, 512, 512)
  const rnd = seeded(base.length * 7919 + light.charCodeAt(1))
  const blob = (color: string, alpha: number, r: number) => {
    const x = rnd() * 512
    const y = rnd() * 512
    const rx = r * (0.6 + rnd())
    const ry = r * (0.35 + rnd() * 0.5)
    for (const [dx, dy] of [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]] as const) {
      const grd = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rx)
      grd.addColorStop(0, color)
      grd.addColorStop(1, 'rgba(0,0,0,0)')
      g.save()
      g.globalAlpha = alpha
      g.translate(x + dx, y + dy)
      g.rotate(rnd() * Math.PI)
      g.scale(1, ry / rx)
      g.translate(-(x + dx), -(y + dy))
      g.fillStyle = grd
      g.beginPath()
      g.arc(x + dx, y + dy, rx, 0, Math.PI * 2)
      g.fill()
      g.restore()
    }
  }
  const deep = darken(base, 0.6)
  for (let i = 0; i < 70; i++) blob(deep, 0.55, 26 + rnd() * 40)
  for (let i = 0; i < 90; i++) blob(light, 0.5, 14 + rnd() * 34)
  for (let i = 0; i < 40; i++) blob(lighten(light, 0.35), 0.35, 6 + rnd() * 14)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1 / 34, 1 / 34) // UVs are in mm → one tile ≈ 34 mm
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  textureCache.set(key, tex)
  return tex
}

function gradientTexture(top: string, bottom: string): THREE.Texture {
  const key = `g${top}${bottom}`
  const hit = textureCache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 256
  const g = c.getContext('2d')!
  const grd = g.createLinearGradient(0, 0, 0, 256)
  grd.addColorStop(0, top)
  grd.addColorStop(1, bottom)
  g.fillStyle = grd
  g.fillRect(0, 0, 4, 256)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.repeat.set(1, 1 / 48)
  tex.offset.set(0, 0.5)
  textureCache.set(key, tex)
  return tex
}

export function frameMaterial(swatch: Swatch, part: 'rim' | 'temple' = 'rim', opts: { transmission?: boolean } = {}): THREE.Material {
  if (part === 'temple' && swatch.temple) return new THREE.MeshPhysicalMaterial({ color: swatch.temple, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 })
  if (swatch.kind === 'metal') return new THREE.MeshStandardMaterial({ color: METAL[swatch.primary] ?? swatch.primary, metalness: 1, roughness: 0.24 })
  if (swatch.kind === 'havana') return new THREE.MeshPhysicalMaterial({ map: havanaTexture(swatch.primary, swatch.secondary ?? '#C08A45'), roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.06 })
  if (swatch.kind === 'crystal' && opts.transmission === false)
    // transparent canvases (hero) have nothing behind them to refract — fake it with alpha
    return new THREE.MeshPhysicalMaterial({ color: swatch.primary, transparent: true, opacity: 0.58, roughness: 0.04, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1, envMapIntensity: 1.4, depthWrite: false })
  if (swatch.kind === 'crystal')
    return new THREE.MeshPhysicalMaterial({
      color: lighten(swatch.primary, 0.5),
      transmission: 0.9,
      thickness: 3,
      roughness: 0.08,
      ior: 1.49,
      attenuationColor: new THREE.Color(swatch.primary),
      attenuationDistance: 12,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    })
  if (swatch.kind === 'gradient') return new THREE.MeshPhysicalMaterial({ map: gradientTexture(swatch.primary, swatch.secondary ?? lighten(swatch.primary, 0.6)), roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 })
  return new THREE.MeshPhysicalMaterial({ color: swatch.primary, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.07 })
}

function metalAccent(swatch: Swatch): THREE.Material {
  const tone = swatch.kind === 'metal' ? swatch.primary : swatch.secondary && METAL[swatch.secondary] ? swatch.secondary : 'silver'
  return new THREE.MeshStandardMaterial({ color: METAL[tone] ?? '#C9CFD4', metalness: 1, roughness: 0.2 })
}

/** Physically based lens glass (PDP viewer). Sunglasses get a tint. */
export function glassMaterial(spec: FrameSpec, swatch: Swatch): THREE.Material {
  const sun = spec.category === 'sun' || !!swatch.lens
  if (sun) {
    const tint = new THREE.Color(swatch.lens ?? '#2B2F33')
    return new THREE.MeshPhysicalMaterial({ color: tint, transmission: 0.35, roughness: 0.04, ior: 1.5, thickness: 1.6, metalness: swatch.mirror ? 0.6 : 0, clearcoat: 1, transparent: true, opacity: 0.94 })
  }
  return new THREE.MeshPhysicalMaterial({ color: '#ffffff', transmission: 1, roughness: 0.02, ior: 1.5, thickness: 1.6, clearcoat: 1, clearcoatRoughness: 0.02, attenuationColor: new THREE.Color('#E8F0FF'), attenuationDistance: 40, specularIntensity: 1 })
}

/* ── model ────────────────────────────────────────────────────────────── */

export function buildFrame(spec: FrameSpec, swatch: Swatch, lensMaterial: (side: 1 | -1) => THREE.Material, opts: { templeLength?: number; transmission?: boolean; knuckles?: number } = {}): FrameParts {
  const L = frameLayout(spec)
  const isMetal = swatch.kind === 'metal' || spec.material === 'metal' || spec.material === 'titan'
  const acetateDepth = isMetal ? 1.4 : Math.max(3.2, Math.min(6, L.rimW * 1.05))
  const rimMat = frameMaterial(swatch, 'rim', opts)
  const templeMat = frameMaterial(swatch, 'temple', opts)
  const accent = metalAccent(swatch)
  const outline = resample(L.outline, 120)
  const root = new THREE.Group()
  const front = new THREE.Group()
  root.add(front)

  // ── rims (per side, then wrapped into the face form)
  for (const s of [1, -1] as const) {
    const ox = s * L.cx
    const pts = outline.map(([x, y]) => [x * s, y] as Pt)
    if (spec.rim === 'full' && spec.shape !== 'browline') {
      if (isMetal) {
        const g = tube(resample(offsetOutline(pts, L.rimW * 0.35), 90).map(([x, y]) => new THREE.Vector3(x + ox, -y, 0)), Math.max(0.55, L.rimW * 0.5), true)
        wrap(g)
        front.add(new THREE.Mesh(g, rimMat))
      } else {
        const shape = new THREE.Shape(offsetOutline(pts, L.rimW).map(toV2))
        shape.holes.push(new THREE.Path(pts.map(toV2)))
        const g = extrude(shape, acetateDepth, 0.7)
        g.translate(ox, 0, 0)
        wrap(g)
        front.add(new THREE.Mesh(g, rimMat))
      }
    } else if (spec.shape === 'browline' || spec.rim === 'semi') {
      // brow / top bar over the upper part of the lens
      let top = 0
      pts.forEach(([, y], i) => {
        if (y < pts[top]![1]) top = i
      })
      const n = pts.length
      const arc: Pt[] = []
      for (let k = -n * 0.3; k <= n * 0.3; k++) arc.push(pts[(top + Math.round(k) + n) % n]!)
      arc.sort((a, b) => a[0] - b[0])
      const browW = spec.shape === 'browline' ? L.rimW * (spec.geometry.browWeight ?? 1.5) : L.rimW
      const shape = band(arc.map(([x, y]) => [x, y - browW * 0.25] as Pt), browW, browW * 0.55)
      const g = extrude(shape, isMetal ? 2.2 : acetateDepth, 0.6)
      g.translate(ox, 0, 0)
      wrap(g)
      front.add(new THREE.Mesh(g, spec.shape === 'browline' ? rimMat : rimMat))
      // thin metal wire around the lens (browline) or nylon line (semi)
      const wire = tube(resample(pts, 90).map(([x, y]) => new THREE.Vector3(x + ox, -y, 0)), spec.shape === 'browline' ? 0.55 : 0.22, true)
      wrap(wire)
      front.add(new THREE.Mesh(wire, spec.shape === 'browline' ? accent : new THREE.MeshPhysicalMaterial({ color: '#dfe5ea', transmission: 0.6, roughness: 0.2 })))
    }
  }

  // ── lenses
  const lensOutlinePts = spec.rim === 'full' && spec.shape !== 'browline' && !isMetal ? offsetOutline(outline, L.rimW * 0.35) : outline
  const lenses: THREE.Mesh[] = []
  for (const s of [1, -1] as const) {
    const shape = new THREE.Shape(lensOutlinePts.map(([x, y]) => toV2([x * s, y])))
    const g = extrude(shape, 1.5, 0.35)
    bulge(g)
    g.translate(s * L.cx, 0, 0.4)
    wrap(g)
    const m = new THREE.Mesh(g, lensMaterial(s))
    m.renderOrder = 2
    m.userData.center = new THREE.Vector3(s * L.cx, 0, 0.6 - (L.cx * L.cx) / (2 * WRAP_R))
    lenses.push(m)
    front.add(m)
  }

  // ── bridge
  const bx = L.bridgeX - (spec.rim === 'rimless' ? 0 : L.rimW * 0.4)
  const by = L.bridgeY
  const style = spec.geometry.bridgeStyle
  const archH = style === 'keyhole' ? Math.max(3.2, spec.bridgeWidth * 0.26) : style === 'straight' ? 0.6 : Math.max(2.2, spec.bridgeWidth * 0.18)
  const bridgePath = cubic([-bx - 0.6, by], [-bx * 0.45, by - archH], [bx * 0.45, by - archH], [bx + 0.6, by])
  if (isMetal || spec.rim === 'rimless') {
    const g = tube(bridgePath.map(([x, y]) => new THREE.Vector3(x, -y, 0)), Math.max(0.65, L.rimW * 0.5), false, 40)
    wrap(g)
    front.add(new THREE.Mesh(g, isMetal ? rimMat : accent))
  } else {
    const g = extrude(band(bridgePath, L.rimW * 1.05, L.rimW * 1.05), acetateDepth, 0.6)
    wrap(g)
    front.add(new THREE.Mesh(g, rimMat))
  }
  if (style === 'double') {
    const topY = -L.b * 0.95 - L.rimW * 0.4
    const x1 = L.cx - L.a * 0.55
    const g = tube(cubic([-x1, topY], [-x1 * 0.35, topY - 1.6], [x1 * 0.35, topY - 1.6], [x1, topY]).map(([x, y]) => new THREE.Vector3(x, -y, 0.2)), 0.7, false, 60)
    wrap(g)
    front.add(new THREE.Mesh(g, isMetal ? rimMat : accent))
  }

  // ── nose pads (metal)
  let pads: THREE.Group | null = null
  if (spec.geometry.pads ?? isMetal) {
    pads = new THREE.Group()
    const padMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transmission: 0.7, roughness: 0.25, thickness: 2 })
    for (const s of [1, -1]) {
      const px = s * (spec.bridgeWidth / 2 + 1.1)
      const arm = tube([new THREE.Vector3(s * (bx - 0.3), -(by + 0.6), -0.4), new THREE.Vector3(px + s * 0.4, -(by + 3), -3), new THREE.Vector3(px, -(by + 5.2), -4.5)], 0.32, false, 20)
      const pad = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), padMat)
      pad.scale.set(1.7, 3.1, 0.7)
      pad.position.set(px, -(by + 8), -5)
      pad.rotation.set(0.3, s * 0.5, s * 0.2)
      pads.add(new THREE.Mesh(arm, accent), pad)
    }
    front.add(pads)
  }

  // ── hinges + temples
  const hingeZ = -(L.hingeX * L.hingeX) / (2 * WRAP_R) - acetateDepth * 0.2
  const templeLen = opts.templeLength ?? 140
  const mkTemple = (s: 1 | -1) => {
    const hinge = new THREE.Group()
    hinge.position.set(s * (L.hingeX + (isMetal ? 0.8 : L.rimW * 0.15)), -L.hingeY, hingeZ)
    // endpiece block + barrels
    const endW = 5.5
    const endH = Math.max(2.6, L.rimW * (isMetal ? 1.8 : 1.15))
    const end = new THREE.Mesh(new THREE.BoxGeometry(endW, endH, isMetal ? 1.6 : acetateDepth * 0.9, 1, 1, 1), isMetal ? rimMat : rimMat)
    end.position.set(s * -endW * 0.35, 0, 0)
    hinge.add(end)
    // barrel: one cylinder, or N interleaved knuckles (odd ones ride on the temple)
    const barrelH = endH * 0.86
    const knuckles = Math.max(1, Math.round(opts.knuckles ?? 1))
    const templeKnuckles: THREE.Mesh[] = []
    for (let k = 0; k < knuckles; k++) {
      const seg = barrelH / knuckles
      const kn = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, knuckles > 1 ? seg * 0.84 : barrelH, 14), accent)
      kn.position.set(s * 1.4, -barrelH / 2 + seg * (k + 0.5), -acetateDepth * 0.55)
      if (k % 2 === 1) templeKnuckles.push(kn)
      else hinge.add(kn)
    }
    // temple: side profile (u = backwards, v = up) with the ear bend, extruded sideways
    const thick = isMetal ? 1.1 : 2.4
    const hStart = Math.max(2.6, endH * 0.8)
    const bendAt = templeLen * 0.72
    const center: Pt[] = []
    for (let i = 0; i <= 40; i++) {
      const u = (i / 40) * templeLen
      // straight run with a slight fall, then the ear bend drops ~26 mm over the last 28 %
      const w = Math.max(0, (u - bendAt) / (templeLen - bendAt))
      const v = -Math.min(u, bendAt) * 0.02 - 26 * w ** 1.6
      center.push([u, v])
    }
    const prof = band(center.map(([u, v]) => [u, -v] as Pt), hStart, 2.4)
    const tg = new THREE.ExtrudeGeometry(prof, { depth: thick, bevelEnabled: true, bevelThickness: 0.45, bevelSize: 0.4, bevelSegments: 2, curveSegments: 4 })
    tg.translate(0, 0, -thick / 2)
    tg.rotateY(Math.PI / 2) // u → −z, thickness → x
    const temple = new THREE.Group()
    const templeMesh = new THREE.Mesh(tg, isMetal ? rimMat : templeMat)
    temple.add(templeMesh)
    if (isMetal) {
      // acetate tip sleeve over the ear bend
      const tip = band(center.slice(26).map(([u, v]) => [u, -v] as Pt), 3, 2.6)
      const sg = new THREE.ExtrudeGeometry(tip, { depth: 2.2, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.45, bevelSegments: 2 })
      sg.translate(0, 0, -1.1)
      sg.rotateY(Math.PI / 2)
      temple.add(new THREE.Mesh(sg, new THREE.MeshPhysicalMaterial({ color: swatch.temple ?? '#1B1F23', roughness: 0.35, clearcoat: 0.8 })))
    }
    temple.position.set(s * 0.6, 0, -acetateDepth * 0.55)
    for (const kn of templeKnuckles) {
      kn.position.sub(temple.position)
      temple.add(kn)
    }
    temple.rotation.y = s * -0.05 // slight outward splay
    hinge.add(temple)
    root.add(hinge)
    return { hinge, temple }
  }
  const R = mkTemple(1)
  const Lt = mkTemple(-1)

  const box = new THREE.Box3().setFromObject(front)
  const size = box.getSize(new THREE.Vector3())
  return {
    root,
    front,
    lensR: lenses[0]!,
    lensL: lenses[1]!,
    hingeR: R.hinge,
    hingeL: Lt.hinge,
    templeR: R.temple,
    templeL: Lt.temple,
    pads,
    anchors: {
      rim: new THREE.Vector3(L.cx + L.a * 0.55, L.b * 0.82, 0),
      lens: new THREE.Vector3(-L.cx - L.a * 0.15, -L.b * 0.25, 1),
      bridge: new THREE.Vector3(0, -by + archH * 0.6, 1),
      hinge: new THREE.Vector3(L.hingeX + 1.5, -L.hingeY, hingeZ),
      temple: new THREE.Vector3(L.hingeX + 2, -L.hingeY - 2, -templeLen * 0.55),
    },
    size: { width: size.x, height: size.y, depth: templeLen },
  }
}

export function disposeObject(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.geometry) m.geometry.dispose()
    const mat = m.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
    else mat?.dispose()
  })
}

/** Renderer + studio environment shared setup. */
export function createStage(canvas: HTMLCanvasElement, opts: { alpha?: boolean; maxDpr?: number } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: opts.alpha ?? true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.maxDpr ?? 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  // RoomEnvironment is loaded lazily by the caller to keep this module small
  return { renderer, scene, pmrem }
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}
