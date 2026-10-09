/**
 * "Anatomia ramei": a scroll-scrubbed exploded view. The section is tall, the
 * stage is sticky; scroll progress drives a camera path through keyframes
 * while the frame comes apart (lenses forward, temples back, hinge knuckles
 * separating) and reassembles at the end. Callout dots, leader lines and
 * dimension lines are SVG in the DOM, projected from the 3D parts each frame.
 */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Swatch } from '@/lib/db/schema'
import { frameLayout, type FrameSpec } from '@/lib/frame-geometry'
import type { AnatomyPost } from './anatomy-post'
import { buildFrame, disposeObject, glassMaterial, type FrameParts } from './frame-model'

export type AnatomyEngine = { dispose: () => void }

type Target = 'center' | 'overview' | 'front' | 'lens' | 'hinge' | 'temple' | 'bridge'
type Key = { p: number; yaw: number; pitch: number; dist: number; e: number; t: Target }

const FOV = 24
// camera path — pairs of identical keys are the holds where a callout is read
const KEYS: Key[] = [
  { p: 0.0, yaw: 0, pitch: 0.05, dist: 1, e: 0, t: 'center' },
  { p: 0.07, yaw: 0, pitch: 0.05, dist: 1, e: 0, t: 'center' },
  { p: 0.2, yaw: 0.66, pitch: 0.3, dist: 1.2, e: 1, t: 'overview' },
  { p: 0.25, yaw: 0.66, pitch: 0.3, dist: 1.2, e: 1, t: 'overview' },
  { p: 0.31, yaw: 0.2, pitch: 0.1, dist: 0.92, e: 1, t: 'front' },
  { p: 0.37, yaw: 0.2, pitch: 0.1, dist: 0.92, e: 1, t: 'front' },
  { p: 0.43, yaw: 0.34, pitch: 0.05, dist: 0.6, e: 1, t: 'lens' },
  { p: 0.49, yaw: 0.34, pitch: 0.05, dist: 0.6, e: 1, t: 'lens' },
  { p: 0.555, yaw: 1.2, pitch: 0.22, dist: 0.3, e: 1, t: 'hinge' },
  { p: 0.615, yaw: 1.2, pitch: 0.22, dist: 0.3, e: 1, t: 'hinge' },
  { p: 0.675, yaw: 1.42, pitch: 0.14, dist: 1.15, e: 1, t: 'temple' },
  { p: 0.735, yaw: 1.42, pitch: 0.14, dist: 1.15, e: 1, t: 'temple' },
  { p: 0.795, yaw: -0.2, pitch: 0.1, dist: 0.62, e: 1, t: 'bridge' },
  { p: 0.855, yaw: -0.2, pitch: 0.1, dist: 0.62, e: 1, t: 'bridge' },
  { p: 0.94, yaw: -0.46, pitch: 0.17, dist: 1.04, e: 0, t: 'center' },
  { p: 1, yaw: -0.46, pitch: 0.17, dist: 1.04, e: 0, t: 'center' },
]
// hold ranges per step (front, lens, hinge, temple, bridge) — keys 4..13
const HOLDS: [number, number][] = [4, 6, 8, 10, 12].map((i) => [KEYS[i]!.p, KEYS[i + 1]!.p])

export function stepAt(p: number): number {
  if (p < 0.28) return -1
  if (p >= 0.9) return 5
  for (let i = HOLDS.length - 1; i >= 0; i--) if (p >= HOLDS[i]![0] - 0.03) return i
  return -1
}

const smooth = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const sstep = (a: number, b: number, v: number) => smooth(clamp01((v - a) / (b - a)))

export type AnatomyOverlay = {
  svg: SVGSVGElement
  leader: SVGPathElement
  dot: SVGGElement
  dims: { line: SVGPathElement; text: SVGTextElement }[]
}

export async function startAnatomyEngine(opts: {
  canvas: HTMLCanvasElement
  section: HTMLElement
  stage: HTMLElement
  overlay: AnatomyOverlay
  spec: FrameSpec
  swatch: Swatch
  templeLength: number
  knuckles: number
  labels: { frameWidth: string; lensWidth: string; lensHeight: string; temple: string; bridge: string }
  onReady: () => void
}): Promise<AnatomyEngine> {
  const { canvas, section, stage, overlay, spec } = opts
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.75 : 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = env
  scene.environmentIntensity = 0.85
  const key = new THREE.DirectionalLight('#FFF1DE', 2.2)
  key.position.set(90, 130, 150)
  const rim = new THREE.DirectionalLight('#7C8CFF', 2.6)
  rim.position.set(-140, 70, -170)
  const under = new THREE.DirectionalLight('#FFFFFF', 0.5)
  under.position.set(0, -120, 60)
  scene.add(key, rim, under)

  // studio backdrop: ink with a soft glow centred on the glasses (redrawn on resize)
  const bgCanvas = document.createElement('canvas')
  const bgTex = new THREE.CanvasTexture(bgCanvas)
  bgTex.colorSpace = THREE.SRGBColorSpace
  scene.background = bgTex

  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 5000)

  const L = frameLayout(spec)
  const lens = () => {
    const m = glassMaterial(spec, opts.swatch) as THREE.MeshPhysicalMaterial
    // the studio env otherwise burns a hard white wedge into the bulge
    m.envMapIntensity = 0.55
    m.clearcoat = 0
    m.specularIntensity = 0.45
    return m
  }
  const parts: FrameParts = buildFrame(spec, opts.swatch, lens, { templeLength: opts.templeLength, knuckles: opts.knuckles })
  scene.add(parts.root)
  const base = {
    hingeR: parts.hingeR.position.clone(),
    hingeL: parts.hingeL.position.clone(),
    templeR: parts.templeR.position.clone(),
    templeL: parts.templeL.position.clone(),
  }
  const lensZ = (parts.lensR.userData.center as THREE.Vector3).z

  // ── layout
  let W = 1
  let H = 1
  let D = 400
  let mobile = false
  const center = { x: 0.5, y: 0.5 }
  const layout = () => {
    const r = stage.getBoundingClientRect()
    W = Math.max(1, r.width)
    H = Math.max(1, r.height)
    mobile = W < 768
    renderer.setSize(W, H, false)
    camera.aspect = W / H
    center.x = mobile ? 0.5 : 0.47
    center.y = mobile ? 0.36 : 0.5
    // frame front fills ~46 % of the width on desktop, ~86 % on phones (bounded by height)
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * camera.aspect)
    const frac = mobile ? 0.84 : 0.46
    D = Math.max(parts.size.width / frac / (2 * Math.tan(hfov / 2)), (parts.size.height / 0.32) / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2))))
    camera.near = D / 20
    camera.far = D * 6
    camera.updateProjectionMatrix()
    overlay.svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
    overlay.svg.setAttribute('width', String(W))
    overlay.svg.setAttribute('height', String(H))
    const dpr = renderer.getPixelRatio()
    bgCanvas.width = Math.round(Math.min(W, 1200) * dpr * 0.5)
    bgCanvas.height = Math.round((bgCanvas.width * H) / W)
    const g = bgCanvas.getContext('2d')!
    const bw = bgCanvas.width
    const bh = bgCanvas.height
    g.fillStyle = '#0B0F13'
    g.fillRect(0, 0, bw, bh)
    const glow = g.createRadialGradient(center.x * bw, center.y * bh, 0, center.x * bw, center.y * bh, Math.max(bw, bh) * 0.55)
    glow.addColorStop(0, '#24313B')
    glow.addColorStop(0.45, '#141C23')
    glow.addColorStop(1, '#0B0F13')
    g.fillStyle = glow
    g.fillRect(0, 0, bw, bh)
    bgTex.needsUpdate = true
    cardAnchor = null
  }

  // ── targets (follow the parts as they move)
  const v = new THREE.Vector3()
  const targetOf = (t: Target, out: THREE.Vector3) => {
    switch (t) {
      case 'overview':
        return out.set(0, 0, -opts.templeLength * 0.32)
      case 'front':
        return out.set(L.cx * 0.35, 0, 0)
      case 'lens':
        return parts.lensR.localToWorld(out.set(L.cx, 0, lensZ))
      case 'hinge':
        return parts.hingeR.localToWorld(out.set(0, 0, -2))
      case 'temple':
        return parts.templeR.localToWorld(out.set(0, -3, -opts.templeLength * 0.35))
      case 'bridge':
        return out.set(0, -L.bridgeY * 0.6, 0)
      default:
        return out.set(0, 0, 0)
    }
  }

  // callout anchor per step and dimension lines (local points on parts)
  const anchorOf = (step: number, out: THREE.Vector3) => {
    switch (step) {
      case 0:
        return out.set(L.cx + L.a * 0.62, L.b + L.rimW * 0.5, 2)
      case 1:
        return parts.lensR.localToWorld(out.set(L.cx - L.a * 0.25, -L.b * 0.3, lensZ + 1))
      case 2:
        return parts.hingeR.localToWorld(out.set(1.4, 0, -2))
      case 3:
        return parts.templeR.localToWorld(out.set(0, 1, -opts.templeLength * 0.8))
      case 4:
        return out.set(0, -L.bridgeY + 1.5, 3)
      default:
        return out.set(0, 0, 0)
    }
  }
  type Dim = { a: THREE.Vector3; b: THREE.Vector3; label: string }
  const dimsOf = (step: number): Dim[] => {
    const below = -(L.b + L.rimW + 5)
    switch (step) {
      case 0:
        return [{ a: new THREE.Vector3(-parts.size.width / 2, below - 3, 0), b: new THREE.Vector3(parts.size.width / 2, below - 3, 0), label: opts.labels.frameWidth }]
      case 1:
        return [
          { a: parts.lensR.localToWorld(new THREE.Vector3(L.cx - L.a, -L.b - 4, lensZ)), b: parts.lensR.localToWorld(new THREE.Vector3(L.cx + L.a, -L.b - 4, lensZ)), label: opts.labels.lensWidth },
          { a: parts.lensR.localToWorld(new THREE.Vector3(L.cx + L.a + 5, -L.b, lensZ)), b: parts.lensR.localToWorld(new THREE.Vector3(L.cx + L.a + 5, L.b, lensZ)), label: opts.labels.lensHeight },
        ]
      case 3:
        return [{ a: parts.templeR.localToWorld(new THREE.Vector3(0, 7, 0)), b: parts.templeR.localToWorld(new THREE.Vector3(0, 7 - opts.templeLength * 0.02, -opts.templeLength)), label: opts.labels.temple }]
      case 4: {
        const x = spec.bridgeWidth / 2
        const y = L.b + L.rimW + 4
        return [{ a: new THREE.Vector3(-x, y, 2), b: new THREE.Vector3(x, y, 2), label: opts.labels.bridge }]
      }
      default:
        return []
    }
  }

  // ── explode
  const explode = (e: number) => {
    const el = sstep(0, 0.65, e)
    const et = sstep(0.25, 1, e)
    parts.lensR.position.set(5 * el, 0, 30 * el)
    parts.lensL.position.set(-5 * el, 0, 30 * el)
    parts.hingeR.position.copy(base.hingeR).add(v.set(9 * et, 0, -3 * et))
    parts.hingeL.position.copy(base.hingeL).add(v.set(-9 * et, 0, -3 * et))
    parts.templeR.position.copy(base.templeR).add(v.set(7 * et, 0, -24 * et))
    parts.templeL.position.copy(base.templeL).add(v.set(-7 * et, 0, -24 * et))
    if (parts.pads) parts.pads.position.set(0, 0, 14 * el)
  }

  // ── projection helpers
  const tmp = new THREE.Vector3()
  const toScreen = (p: THREE.Vector3) => {
    tmp.copy(p).project(camera)
    return { x: ((tmp.x + 1) / 2) * W, y: ((1 - tmp.y) / 2) * H }
  }

  // ── progress
  const progressNow = () => {
    const r = section.getBoundingClientRect()
    const total = Math.max(1, r.height - window.innerHeight)
    return clamp01(-r.top / total)
  }
  let pSmooth = progressNow()
  let pointer = { x: 0, y: 0 }
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    pointer = { x: e.clientX / window.innerWidth - 0.5, y: e.clientY / window.innerHeight - 0.5 }
  }
  window.addEventListener('pointermove', onMove, { passive: true })

  let cardAnchor: { x: number; y: number } | null = null
  let step = -2
  // desktop: depth of field that racks focus onto the part being explained, plus a little bloom
  let post: AnatomyPost | null = null
  if (!coarse && window.innerWidth >= 1024 && (navigator.hardwareConcurrency ?? 4) >= 4) {
    try {
      const { createAnatomyPost } = await import('./anatomy-post')
      post = createAnatomyPost(renderer, scene, camera)
    } catch {
      post = null
    }
  }
  const ro = new ResizeObserver(() => {
    layout()
    post?.setSize(W, H)
  })
  ro.observe(stage)
  layout()
  post?.setSize(W, H)
  let visible = true
  const io = new IntersectionObserver(([en]) => (visible = !!en?.isIntersecting))
  io.observe(section)

  const tA = new THREE.Vector3()
  const tB = new THREE.Vector3()
  const target = new THREE.Vector3()
  const anchor = new THREE.Vector3()
  const focusPt = new THREE.Vector3()
  let raf = 0
  let last = performance.now()
  let first = true
  const t0 = last
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop)
    if (!visible || document.hidden) return
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000))
    last = now
    const t = (now - t0) / 1000
    pSmooth += (progressNow() - pSmooth) * (1 - Math.exp(-dt * 9))
    const p = pSmooth

    // keyframe interpolation
    let i = 0
    while (i < KEYS.length - 2 && p > KEYS[i + 1]!.p) i++
    const a = KEYS[i]!
    const b = KEYS[i + 1]!
    const f = smooth(clamp01((p - a.p) / Math.max(1e-6, b.p - a.p)))
    const lerp = (x: number, y: number) => x + (y - x) * f
    explode(lerp(a.e, b.e))
    parts.root.updateMatrixWorld(true)
    targetOf(a.t, tA)
    targetOf(b.t, tB)
    target.lerpVectors(tA, tB, f)
    const yaw = lerp(a.yaw, b.yaw) + Math.sin(t * 0.35) * 0.025 + pointer.x * 0.12
    const pitch = lerp(a.pitch, b.pitch) + Math.sin(t * 0.5 + 1) * 0.012 - pointer.y * 0.06
    // wide shots need more room on a portrait phone
    const room = (k: Key) => (mobile && (k.t === 'overview' || k.t === 'temple') ? 1.4 : 1)
    const dist = lerp(a.dist * room(a), b.dist * room(b)) * D
    camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * dist, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * Math.cos(pitch) * dist)
    camera.lookAt(target)
    camera.updateMatrixWorld()
    // lens shift: the glasses sit lower while the intro title is up, then settle in the middle
    const intro = 1 - sstep(0.05, 0.16, p)
    const fin = sstep(0.88, 0.96, p)
    const cy = center.y + intro * (mobile ? 0.22 : 0.09) - fin * (mobile ? 0.1 : 0.12)
    camera.setViewOffset(W, H, W / 2 - center.x * W, H / 2 - cy * H, W, H)

    // step & overlay
    const s = stepAt(p)
    if (s !== step) {
      step = s
      cardAnchor = null
      // the active card / index entry are pure CSS off this attribute — same frame as the overlay
      stage.dataset.step = String(s)
    }
    const hold = s >= 0 && s < 5 ? sstep(HOLDS[s]![0] - 0.035, HOLDS[s]![0] - 0.005, p) * (1 - sstep(HOLDS[s]![1] + 0.005, HOLDS[s]![1] + 0.035, p)) : 0
    overlay.svg.style.opacity = String(hold)
    stage.style.setProperty('--anat-intro', String(intro))
    stage.style.setProperty('--anat-final', String(fin))
    if (hold > 0.001) {
      if (!cardAnchor) {
        const card = stage.querySelector<HTMLElement>(`[data-anat-card="${s}"]`)
        if (card) {
          // layout box (ignores the card's own entrance transform)
          let x = 0
          let y = 0
          let el: HTMLElement | null = card
          while (el && el !== stage) {
            x += el.offsetLeft
            y += el.offsetTop
            el = el.offsetParent as HTMLElement | null
          }
          cardAnchor = mobile ? { x: x + card.offsetWidth / 2, y } : { x, y: y + 34 }
        }
      }
      const pt = toScreen(anchorOf(s, anchor))
      overlay.dot.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`)
      if (cardAnchor) {
        const k = cardAnchor
        const d = mobile ? `M${pt.x} ${pt.y} L${pt.x} ${pt.y + (k.y - pt.y) * 0.5} L${k.x} ${k.y - 14} L${k.x} ${k.y - 4}` : `M${pt.x} ${pt.y} L${k.x - 48} ${k.y} L${k.x - 8} ${k.y}`
        overlay.leader.setAttribute('d', d)
      }
      const dims = dimsOf(s)
      overlay.dims.forEach((dim, j) => {
        const dd = dims[j]
        if (!dd) {
          dim.line.setAttribute('d', '')
          dim.text.textContent = ''
          return
        }
        const A = toScreen(dd.a)
        const B = toScreen(dd.b)
        const len = Math.hypot(B.x - A.x, B.y - A.y) || 1
        const nx = -(B.y - A.y) / len
        const ny = (B.x - A.x) / len
        const tk = 6
        dim.line.setAttribute('d', `M${A.x} ${A.y} L${B.x} ${B.y} M${A.x - nx * tk} ${A.y - ny * tk} L${A.x + nx * tk} ${A.y + ny * tk} M${B.x - nx * tk} ${B.y - ny * tk} L${B.x + nx * tk} ${B.y + ny * tk}`)
        // label sits on the outer side of the line, upright
        const side = ny > 0 ? 1 : -1
        dim.text.setAttribute('x', String((A.x + B.x) / 2 + nx * 16 * side))
        dim.text.setAttribute('y', String((A.y + B.y) / 2 + ny * 16 * side + 4))
        dim.text.textContent = dd.label
      })
    }

    if (post) {
      // rack focus: the subject sharp and the rest soft while a part is explained; deep focus otherwise
      const focusOn = s >= 0 && s < 5 ? anchorOf(s, focusPt) : focusPt.copy(target)
      post.setFocus(camera.position.distanceTo(focusOn), s >= 0 && s < 5 ? 0.2 + 0.8 * hold : 0.08)
      post.render()
    } else renderer.render(scene, camera)
    if (first) {
      first = false
      opts.onReady()
    }
  }
  raf = requestAnimationFrame(loop)

  return {
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      window.removeEventListener('pointermove', onMove)
      disposeObject(parts.root)
      post?.dispose()
      bgTex.dispose()
      env.dispose()
      pmrem.dispose()
      renderer.dispose()
    },
  }
}
