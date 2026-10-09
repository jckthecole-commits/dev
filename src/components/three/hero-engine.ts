/**
 * Hero 3D engine: a real pair of glasses floating over the blurred optotype.
 * Through the lenses the chart is sharp — the lens shader samples a crisp copy
 * of the chart in screen space, magnified like a real plus lens, with a touch
 * of chromatic aberration towards the edge. Loaded lazily after first paint.
 */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Swatch } from '@/lib/db/schema'
import type { FrameSpec } from '@/lib/frame-geometry'
import { buildFrame, disposeObject, type FrameParts } from './frame-model'

export type EngineFrame = { spec: FrameSpec; templeLength: number; variants: { swatch: Swatch }[] }
export type HeroEngine = { show: (frame: number, variant: number) => void; dispose: () => void; nudge: () => void }

const FOV = 20
const REF_WIDTH = 150 // mm that map onto the layout anchor's width — every frame keeps its true relative size

const VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = -mv.xyz;
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`

const FRAG = /* glsl */ `
uniform sampler2D uChart;
uniform vec2 uRes;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uMag;
uniform vec3 uTint;
uniform float uTintAmt;
uniform float uStreak;
varying vec3 vN;
varying vec3 vV;
void main() {
  vec2 rel = gl_FragCoord.xy - uCenter;
  float d = clamp(length(rel) / max(uRadius, 1.0), 0.0, 1.5);
  float ca = 0.022 * d * d;
  vec2 base = uCenter + rel * uMag;
  vec3 col;
  col.r = texture2D(uChart, (uCenter + rel * uMag * (1.0 + ca)) / uRes).r;
  col.g = texture2D(uChart, base / uRes).g;
  col.b = texture2D(uChart, (uCenter + rel * uMag * (1.0 - ca)) / uRes).b;
  col = mix(col, col * uTint, uTintAmt);
  vec3 n = normalize(vN);
  vec3 v = normalize(vV);
  float fres = pow(1.0 - abs(dot(n, v)), 3.0);
  col += fres * 0.28;
  // two soft specular streaks that slide as the glasses turn
  float s = fract((gl_FragCoord.x * 0.82 + gl_FragCoord.y * 0.55) / (uRadius * 3.6) + uStreak);
  float streak = smoothstep(0.0, 0.03, s) * (1.0 - smoothstep(0.03, 0.12, s)) * 0.32
               + smoothstep(0.18, 0.2, s) * (1.0 - smoothstep(0.2, 0.23, s)) * 0.18;
  col += streak;
  // a hint of blue AR coating at grazing angles
  col = mix(col, col * vec3(0.92, 0.95, 1.06), fres);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`

export async function startHeroEngine(opts: { canvas: HTMLCanvasElement; hero: HTMLElement; anchor: HTMLElement; chart: HTMLElement; frames: EngineFrame[]; frame: number; variant: number; onReady: () => void; onInteract?: () => void }): Promise<HeroEngine> {
  const { canvas, hero, anchor, chart, frames } = opts
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.75 : 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = env
  scene.environmentIntensity = 0.95
  const key = new THREE.DirectionalLight(0xffffff, 1.4)
  key.position.set(-60, 120, 160)
  scene.add(key)

  const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 6000)

  // ── crisp copy of the optotype, drawn from the DOM layout so it lines up with the blurred one
  const chartCanvas = document.createElement('canvas')
  const chartTex = new THREE.CanvasTexture(chartCanvas)
  chartTex.colorSpace = THREE.SRGBColorSpace
  chartTex.minFilter = THREE.LinearFilter
  chartTex.generateMipmaps = false
  const drawChart = () => {
    const dpr = renderer.getPixelRatio()
    const hr = hero.getBoundingClientRect()
    chartCanvas.width = Math.max(2, Math.round(hr.width * dpr))
    chartCanvas.height = Math.max(2, Math.round(hr.height * dpr))
    const g = chartCanvas.getContext('2d')!
    g.fillStyle = '#F7F9F8'
    g.fillRect(0, 0, chartCanvas.width, chartCanvas.height)
    g.fillStyle = '#0D1216'
    g.textBaseline = 'middle'
    for (const row of Array.from(chart.querySelectorAll<HTMLElement>('.chart-row'))) {
      const r = row.getBoundingClientRect()
      const cs = getComputedStyle(row)
      const size = parseFloat(cs.fontSize) * (r.height / Math.max(1, row.offsetHeight || r.height))
      g.font = `${cs.fontWeight} ${size * dpr}px ${cs.fontFamily}`
      const spacing = (parseFloat(cs.letterSpacing) || 0) * (size / parseFloat(cs.fontSize)) * dpr
      const text = row.textContent ?? ''
      const widths = Array.from(text).map((ch) => g.measureText(ch).width)
      const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, text.length - 1)
      let x = (r.left - hr.left + r.width / 2) * dpr - total / 2 + (parseFloat(cs.paddingLeft) || 0) * dpr * 0.5
      const y = (r.top - hr.top + r.height / 2) * dpr
      Array.from(text).forEach((ch, i) => {
        g.fillText(ch, x, y)
        x += widths[i]! + spacing
      })
    }
    chartTex.needsUpdate = true
  }

  // ── lens shader (one material per lens: each has its own screen-space centre)
  const lensUniforms: { uCenter: { value: THREE.Vector2 }; uRadius: { value: number }; uTint: { value: THREE.Color }; uTintAmt: { value: number }; uStreak: { value: number } }[] = []
  const uRes = { value: new THREE.Vector2(1, 1) }
  const makeLens = (swatch: Swatch, spec: FrameSpec) => {
    const sun = spec.category === 'sun' || !!swatch.lens
    const u = {
      uChart: { value: chartTex },
      uRes,
      uCenter: { value: new THREE.Vector2() },
      uRadius: { value: 100 },
      uMag: { value: 0.885 },
      uTint: { value: new THREE.Color(sun ? (swatch.lens ?? '#3A3F44') : '#ffffff') },
      uTintAmt: { value: sun ? 0.82 : 0 },
      uStreak: { value: 0 },
    }
    lensUniforms.push(u)
    const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG })
    m.toneMapped = false
    return m
  }

  // ── shadow
  const shadowCanvas = document.createElement('canvas')
  shadowCanvas.width = shadowCanvas.height = 128
  {
    const g = shadowCanvas.getContext('2d')!
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grd.addColorStop(0, 'rgba(13,18,22,0.32)')
    grd.addColorStop(1, 'rgba(13,18,22,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 128, 128)
  }
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false, toneMapped: false }))
  shadow.rotation.x = -Math.PI / 2
  scene.add(shadow)

  // ── model management
  const stage = new THREE.Group() // positioned on the layout anchor
  const spinner = new THREE.Group() // yaw/pitch/spin
  stage.add(spinner)
  scene.add(stage)
  let parts: FrameParts | null = null
  let current = { frame: opts.frame, variant: opts.variant }
  const build = (fi: number, vi: number) => {
    if (parts) {
      spinner.remove(parts.root)
      disposeObject(parts.root)
    }
    lensUniforms.length = 0
    const f = frames[fi]!
    const v = f.variants[vi] ?? f.variants[0]!
    parts = buildFrame(f.spec, v.swatch, () => makeLens(v.swatch, f.spec), { templeLength: f.templeLength, transmission: false })
    // temples a little folded so the silhouette reads in 3/4 view
    parts.templeR.rotation.y = 0.38
    parts.templeL.rotation.y = -0.38
    spinner.add(parts.root)
    shadow.scale.set(parts.size.width * 1.05, 46, 1)
    shadow.position.y = -parts.size.height / 2 - 14
  }
  build(current.frame, current.variant)

  // ── layout: put the model where the DOM anchor is, at a fixed mm→px scale
  let W = 1
  let H = 1
  const layout = () => {
    const hr = hero.getBoundingClientRect()
    W = Math.max(1, hr.width)
    H = Math.max(1, hr.height)
    renderer.setSize(W, H, false)
    camera.aspect = W / H
    const ar = anchor.getBoundingClientRect()
    const anchorW = Math.max(160, ar.width)
    const D = (REF_WIDTH * H) / (anchorW * 2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)))
    camera.position.set(0, 0, D)
    camera.near = D / 10
    camera.far = D * 4
    camera.updateProjectionMatrix()
    // lens shift instead of moving the model off-axis: no perspective skew wherever the anchor sits
    const cx = ar.left - hr.left + ar.width / 2
    const cy = ar.top - hr.top + ar.height / 2
    camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H)
    stage.position.set(0, 0, 0)
    const buf = renderer.getDrawingBufferSize(new THREE.Vector2())
    uRes.value.copy(buf)
    drawChart()
  }
  // the blurred chart drifts on phones (CSS); the lenses show a still copy of it, so the
  // chart is stopped where the copy is drawn — otherwise the two drift apart and the
  // lenses show fragments of the wrong letters
  chart.style.animation = 'none'
  layout()
  await document.fonts?.ready
  drawChart()

  // ── interaction
  const target = { yaw: -0.24, pitch: 0.16 }
  const cur = { yaw: -0.24, pitch: 0.16, spin: 0, spinV: 0 }
  let pointer: { x: number; y: number } | null = null
  let drag: { x: number; y: number; t: number } | null = null
  let tilt: { x: number; y: number } | null = null
  let transition: { t0: number; to: { frame: number; variant: number }; swapped: boolean; full: boolean } | null = null
  let interacted = false
  const markInteract = () => {
    if (!interacted) {
      interacted = true
      opts.onInteract?.()
    }
  }

  const onMove = (e: PointerEvent) => {
    const hr = hero.getBoundingClientRect()
    if (drag) {
      const dx = e.clientX - drag.x
      const now = performance.now()
      cur.spinV = (dx / Math.max(1, now - drag.t)) * 0.012
      cur.spin += dx * 0.011
      drag.x = e.clientX
      drag.t = now
      if (Math.abs(dx) > 1) markInteract()
      return
    }
    if (e.pointerType === 'mouse') pointer = { x: (e.clientX - hr.left) / hr.width, y: (e.clientY - hr.top) / hr.height }
  }
  const onDown = (e: PointerEvent) => {
    const el = e.target as HTMLElement
    if (el.closest('a,button,input,label')) return
    // only start a drag near the glasses — the rest of the hero keeps normal behaviour
    const ar = anchor.getBoundingClientRect()
    const pad = 80
    if (e.clientX < ar.left - pad || e.clientX > ar.right + pad || e.clientY < ar.top - pad || e.clientY > ar.bottom + pad) return
    drag = { x: e.clientX, y: e.clientY, t: performance.now() }
    hero.setPointerCapture?.(e.pointerId)
  }
  const onUp = () => {
    drag = null
  }
  const onLeave = () => {
    pointer = null
  }
  const onOrient = (e: DeviceOrientationEvent) => {
    if (e.gamma == null || e.beta == null) return
    tilt = { x: Math.max(-1, Math.min(1, e.gamma / 28)), y: Math.max(-1, Math.min(1, (e.beta - 50) / 28)) }
  }
  hero.addEventListener('pointermove', onMove)
  hero.addEventListener('pointerdown', onDown)
  window.addEventListener('pointerup', onUp)
  hero.addEventListener('pointerleave', onLeave)
  window.addEventListener('deviceorientation', onOrient)

  const ro = new ResizeObserver(() => layout())
  ro.observe(hero)
  let visible = true
  const io = new IntersectionObserver(([en]) => (visible = !!en?.isIntersecting))
  io.observe(hero)

  // ── loop
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
  const tmp = new THREE.Vector3()
  const tmp2 = new THREE.Vector3()
  const project = (v: THREE.Vector3) => {
    tmp.copy(v).project(camera)
    return new THREE.Vector2(((tmp.x + 1) / 2) * uRes.value.x, ((tmp.y + 1) / 2) * uRes.value.y)
  }
  let raf = 0
  let last = performance.now()
  let first = true
  const t0 = last
  const frameLoop = (now: number) => {
    raf = requestAnimationFrame(frameLoop)
    if (!visible || document.hidden) return
    // rAF timestamps can precede performance.now() — never let dt go negative (the smoothing would diverge)
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000))
    last = now
    const t = (now - t0) / 1000

    // targets: cursor, gyroscope or idle drift
    if (tilt && coarse) {
      target.yaw = tilt.x * 0.5
      target.pitch = 0.16 + tilt.y * 0.14
    } else if (pointer) {
      const ar = anchor.getBoundingClientRect()
      const hr = hero.getBoundingClientRect()
      target.yaw = Math.max(-0.62, Math.min(0.62, (pointer.x - (ar.left - hr.left + ar.width / 2) / W) * 1.5))
      target.pitch = Math.max(0.04, Math.min(0.34, 0.16 + (pointer.y - (ar.top - hr.top + ar.height / 2) / H) * 0.5))
    } else if (!reduce) {
      target.yaw = -0.24 + Math.sin(t * 0.42) * 0.3
      target.pitch = 0.16 + Math.sin(t * 0.7 + 1) * 0.05
    }
    const k = reduce ? 1 : 1 - Math.exp(-dt * 4.2)
    cur.yaw += (target.yaw - cur.yaw) * k
    cur.pitch += (target.pitch - cur.pitch) * k
    if (!drag) {
      cur.spin += cur.spinV
      cur.spinV *= Math.exp(-dt * 2.6)
      // settle back to a whole turn once the flick is over
      if (Math.abs(cur.spinV) < 0.002) {
        const home = Math.round(cur.spin / (Math.PI * 2)) * Math.PI * 2
        cur.spin += (home - cur.spin) * (1 - Math.exp(-dt * 2.2))
      }
    }

    // frame switch: a full turn with a dip in scale, swapping the model mid-turn
    let extraSpin = 0
    let scale = 1
    if (transition) {
      const p = Math.min(1, (now - transition.t0) / (reduce ? 1 : 950))
      const e = ease(p)
      extraSpin = transition.full ? e * Math.PI * 2 : 0
      scale = transition.full ? 1 - Math.sin(p * Math.PI) * 0.22 : 1
      if (p >= 0.5 && !transition.swapped) {
        transition.swapped = true
        build(transition.to.frame, transition.to.variant)
        current = transition.to
      }
      if (p >= 1) {
        cur.spin += extraSpin
        extraSpin = 0
        transition = null
      }
    }

    // scroll: the glasses turn away and rise as the hero leaves
    const hr = hero.getBoundingClientRect()
    const sp = Math.max(0, Math.min(1, -hr.top / Math.max(1, hr.height)))
    const float = reduce ? 0 : Math.sin(t * 1.15) * 1.6
    spinner.rotation.set(cur.pitch + sp * 0.35, cur.yaw + cur.spin + extraSpin + sp * 1.4, -cur.yaw * 0.05)
    spinner.position.set(0, float + sp * 26, 0)
    spinner.scale.setScalar(scale * (1 - sp * 0.12))
    shadow.position.x = 0
    ;(shadow.material as THREE.MeshBasicMaterial).opacity = (1 - sp) * (1 - Math.abs(float) / 8)

    // lens uniforms (screen-space centre & radius)
    if (parts) {
      scene.updateMatrixWorld()
      const lenses = [parts.lensR, parts.lensL]
      lenses.forEach((lens, i) => {
        const u = lensUniforms[i]
        if (!u) return
        const c = lens.userData.center as THREE.Vector3
        tmp2.copy(c)
        lens.parent!.localToWorld(tmp2)
        const center = project(tmp2)
        tmp2.copy(c).add(new THREE.Vector3(frames[current.frame]!.spec.lensWidth / 2, 0, 0))
        lens.parent!.localToWorld(tmp2)
        const edge = project(tmp2)
        u.uCenter.value.copy(center)
        u.uRadius.value = Math.max(40, edge.distanceTo(center))
        u.uStreak.value = (cur.yaw + cur.spin + extraSpin) * 0.35 + i * 0.13
      })
    }
    renderer.render(scene, camera)
    if (first) {
      first = false
      opts.onReady()
    }
  }
  raf = requestAnimationFrame(frameLoop)

  return {
    show(frame, variant) {
      if (frame === current.frame && variant === current.variant) return
      if (frame === current.frame) {
        build(frame, variant) // colour swap: instant, no turn
        current = { frame, variant }
        return
      }
      transition = { t0: performance.now(), to: { frame, variant }, swapped: false, full: true }
    },
    nudge() {
      cur.spinV = 0.16
    },
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      hero.removeEventListener('pointermove', onMove)
      hero.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      hero.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('deviceorientation', onOrient)
      if (parts) disposeObject(parts.root)
      chart.style.animation = ''
      chartTex.dispose()
      env.dispose()
      pmrem.dispose()
      renderer.dispose()
    },
  }
}
