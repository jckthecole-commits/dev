/**
 * PDP 360° viewer: the frame built from its real millimetre geometry, on the
 * gallery's own background so the lenses and crystal acetate can refract it.
 * Drag (or arrow keys) to turn, double-click to reset, temples fold on demand.
 * Idles with a slow turntable spin until someone touches it.
 */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Swatch } from '@/lib/db/schema'
import type { FrameSpec } from '@/lib/frame-geometry'
import { buildFrame, disposeObject, glassMaterial, type FrameParts } from './frame-model'

export type ViewerEngine = {
  setSwatch: (swatch: Swatch) => void
  setFolded: (folded: boolean) => void
  reset: () => void
  dispose: () => void
}

const FOV = 22
const BG = '#F8F9F8'

export async function startViewerEngine(opts: { canvas: HTMLCanvasElement; spec: FrameSpec; swatch: Swatch; templeLength: number; knuckles?: number; onReady: () => void; onInteract?: () => void }): Promise<ViewerEngine> {
  const { canvas, spec } = opts
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.75 : 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.setClearColor(BG, 1)

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = env
  scene.environmentIntensity = 1
  const key = new THREE.DirectionalLight('#ffffff', 1.3)
  key.position.set(-80, 140, 160)
  scene.add(key)

  // contact shadow
  const sc = document.createElement('canvas')
  sc.width = sc.height = 128
  {
    const g = sc.getContext('2d')!
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grd.addColorStop(0, 'rgba(13,18,22,0.26)')
    grd.addColorStop(1, 'rgba(13,18,22,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 128, 128)
  }
  const shadowTex = new THREE.CanvasTexture(sc)
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false }))
  shadow.rotation.x = -Math.PI / 2
  scene.add(shadow)

  const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 5000)
  const spinner = new THREE.Group()
  scene.add(spinner)
  let parts: FrameParts | null = null
  let fold = 0
  let foldTarget = 0
  let centres: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(), new THREE.Vector3()]
  let frontZ = 0 // how far the front sits in front of the turn axis
  const build = (swatch: Swatch) => {
    if (parts) {
      spinner.remove(parts.root)
      disposeObject(parts.root)
    }
    parts = buildFrame(spec, swatch, () => glassMaterial(spec, swatch), { templeLength: opts.templeLength, knuckles: opts.knuckles })
    // turn about the middle of the whole thing — open and folded have different middles
    const centre = (e: number) => {
      parts!.templeR.rotation.y = e * 1.52
      parts!.templeL.rotation.y = -e * 1.52
      parts!.root.updateMatrixWorld(true)
      return new THREE.Box3().setFromObject(parts!.root).getCenter(new THREE.Vector3())
    }
    centres = [centre(0), centre(1)]
    spinner.add(parts.root)
    shadow.scale.set(parts.size.width * 1.1, opts.templeLength * 1.05, 1)
    shadow.position.y = -parts.size.height / 2 - 16
    applyFold()
  }
  const applyFold = () => {
    if (!parts) return
    const e = fold * fold * (3 - 2 * fold)
    parts.templeR.rotation.y = e * 1.52
    parts.templeL.rotation.y = -e * 1.52
    const c = centres[0].clone().lerp(centres[1], e)
    parts.root.position.set(0, -c.y, -c.z)
    frontZ = -c.z
  }
  build(opts.swatch)

  // camera distance breathes with the turn: the front fills ~74 % of the width,
  // and side-on the temples still fit
  const dist = { front: 400, side: 400 }
  const layout = () => {
    const W = Math.max(1, canvas.clientWidth)
    const H = Math.max(1, canvas.clientHeight)
    renderer.setSize(W, H, false)
    camera.aspect = W / H
    const span = 2 * Math.tan(Math.atan(Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * camera.aspect))
    // distances are to the turn axis: add how far the nearest part sits in front of it
    dist.front = parts!.size.width / 0.74 / span
    dist.side = Math.max(dist.front, (opts.templeLength + 24) / 0.86 / span + parts!.size.width / 2)
    camera.near = dist.front / 10
    camera.far = dist.side * 4
    camera.updateProjectionMatrix()
  }
  layout()
  const ro = new ResizeObserver(layout)
  ro.observe(canvas)

  // ── interaction
  const cur = { yaw: 0, pitch: 0.1 }
  let vel = 0
  let drag: { x: number; y: number; t: number } | null = null
  let lastTouch = -1e9
  let idle = !reduce
  const touched = () => {
    lastTouch = performance.now()
    if (idle) {
      idle = false
      opts.onInteract?.()
    }
  }
  const onDown = (e: PointerEvent) => {
    drag = { x: e.clientX, y: e.clientY, t: performance.now() }
    canvas.setPointerCapture(e.pointerId)
    touched()
  }
  const onMove = (e: PointerEvent) => {
    if (!drag) return
    const now = performance.now()
    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    cur.yaw += dx * 0.012
    cur.pitch = Math.max(-0.5, Math.min(0.6, cur.pitch + dy * 0.006))
    vel = (dx * 0.012) / Math.max(8, now - drag.t) * 16
    drag = { x: e.clientX, y: e.clientY, t: now }
    lastTouch = now
  }
  const onUp = () => {
    drag = null
  }
  const onKey = (e: KeyboardEvent) => {
    const step = 0.26
    if (e.key === 'ArrowLeft') cur.yaw -= step
    else if (e.key === 'ArrowRight') cur.yaw += step
    else if (e.key === 'ArrowUp') cur.pitch = Math.max(-0.5, cur.pitch - 0.12)
    else if (e.key === 'ArrowDown') cur.pitch = Math.min(0.6, cur.pitch + 0.12)
    else return
    e.preventDefault()
    vel = 0
    touched()
  }
  const reset = () => {
    const turns = Math.round(cur.yaw / (Math.PI * 2))
    resetTo = { yaw: turns * Math.PI * 2, pitch: 0.1 }
    vel = 0
    touched()
  }
  let resetTo: { yaw: number; pitch: number } | null = null
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)
  canvas.addEventListener('keydown', onKey)
  canvas.addEventListener('dblclick', reset)

  let visible = true
  const io = new IntersectionObserver(([en]) => (visible = !!en?.isIntersecting))
  io.observe(canvas)

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
    if (!drag) {
      cur.yaw += vel
      vel *= Math.exp(-dt * 3.2)
      // turntable: from the start, and again (easing in) after a few quiet seconds
      const ramp = idle ? 1 : Math.max(0, Math.min(1, (now - lastTouch - 4500) / 1500))
      if (!reduce && !resetTo && Math.abs(vel) < 0.002) cur.yaw += dt * 0.32 * ramp
    }
    if (resetTo) {
      const k = 1 - Math.exp(-dt * 6)
      cur.yaw += (resetTo.yaw - cur.yaw) * k
      cur.pitch += (resetTo.pitch - cur.pitch) * k
      if (Math.abs(resetTo.yaw - cur.yaw) < 0.002) resetTo = null
    }
    const f = foldTarget - fold
    if (Math.abs(f) > 1e-4) {
      fold += Math.sign(f) * Math.min(Math.abs(f), dt * (reduce ? 100 : 1.8))
      applyFold()
    }
    spinner.rotation.set(cur.pitch, cur.yaw, 0)
    const side = Math.abs(Math.sin(cur.yaw)) ** 1.2 * (1 - fold * 0.7)
    camera.position.set(0, 0, dist.front + frontZ + (dist.side - dist.front - frontZ) * side)
    spinner.position.y = reduce ? 0 : Math.sin(t * 1.1) * 0.8
    renderer.render(scene, camera)
    if (first) {
      first = false
      opts.onReady()
    }
  }
  raf = requestAnimationFrame(loop)

  return {
    setSwatch(swatch) {
      build(swatch)
    },
    setFolded(v) {
      foldTarget = v ? 1 : 0
      touched()
    },
    reset,
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('keydown', onKey)
      canvas.removeEventListener('dblclick', reset)
      if (parts) disposeObject(parts.root)
      shadowTex.dispose()
      env.dispose()
      pmrem.dispose()
      renderer.dispose()
    },
  }
}
