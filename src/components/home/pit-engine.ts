/**
 * "Groapa cu rame": the whole collection as rigid bodies (matter.js). Every frame keeps
 * its true size relative to the others. Grab and throw on desktop; on a phone, tilt it.
 * The DOM images are moved by transform on each step — no canvas, crisp at any zoom.
 */
import Matter from 'matter-js'

export type PitBody = { w: number; h: number }
export type Pit = { drop: () => void; shake: () => void; tilt: (gx: number, gy: number) => void; dispose: () => void }

const { Engine, Bodies, Body, Composite, Query, Constraint, Vector, Sleeping } = Matter

export function startPit(opts: {
  box: HTMLElement
  els: HTMLElement[]
  sizes: PitBody[]
  onHover: (i: number | null) => void
  onTap: (i: number) => void
  onFrame: (positions: { x: number; y: number }[]) => void
}): Pit {
  const { box, els, sizes } = opts
  const engine = Engine.create({ enableSleeping: true })
  engine.gravity.y = 1.1
  const world = engine.world
  let W = box.clientWidth
  let H = box.clientHeight

  // walls: floor, sides and a lid well above the box (thrown frames come back down)
  const T = 200
  const walls = [
    Bodies.rectangle(W / 2, H + T / 2, W * 3, T, { isStatic: true }),
    Bodies.rectangle(-T / 2, H / 2 - H, T, H * 4, { isStatic: true }),
    Bodies.rectangle(W + T / 2, H / 2 - H, T, H * 4, { isStatic: true }),
    Bodies.rectangle(W / 2, -H * 1.6, W * 3, T, { isStatic: true }),
  ]
  Composite.add(world, walls)

  // bodies: the frame's silhouette is roughly the middle of its drawing
  const bodies = sizes.map((s, i) =>
    Bodies.rectangle(W / 2, -200 - i * 60, s.w * 0.86, s.h * 0.56, {
      chamfer: { radius: Math.min(s.h * 0.2, 14) },
      restitution: 0.32,
      friction: 0.35,
      frictionAir: 0.012,
      density: 0.0016,
      sleepThreshold: 40,
    }),
  )
  Composite.add(world, bodies)

  const drop = () => {
    bodies.forEach((b, i) => {
      Sleeping.set(b, false)
      Body.setPosition(b, { x: W * (0.12 + Math.random() * 0.76), y: -80 - i * (H / sizes.length) * 0.9 - Math.random() * 60 })
      Body.setAngle(b, (Math.random() - 0.5) * 1.4)
      Body.setVelocity(b, { x: (Math.random() - 0.5) * 4, y: 0 })
      Body.setAngularVelocity(b, (Math.random() - 0.5) * 0.12)
    })
  }

  // ── pointer: grab, throw, tap
  let grab: { c: Matter.Constraint; i: number; x0: number; y0: number; t0: number; moved: boolean } | null = null
  const local = (e: { clientX: number; clientY: number }) => {
    const r = box.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const hit = (p: { x: number; y: number }) => {
    const found = Query.point(bodies, p)
    return found.length ? bodies.indexOf(found[found.length - 1]!) : -1
  }
  const onDown = (e: PointerEvent) => {
    const p = local(e)
    const i = hit(p)
    if (i < 0) return
    const b = bodies[i]!
    Sleeping.set(b, false)
    const c = Constraint.create({ pointA: p, bodyB: b, pointB: Vector.sub(p, b.position), stiffness: 0.12, damping: 0.08, length: 0 })
    Composite.add(world, c)
    grab = { c, i, x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false }
    box.setPointerCapture(e.pointerId)
    box.dataset.grabbing = ''
  }
  const onMove = (e: PointerEvent) => {
    const p = local(e)
    if (grab) {
      grab.c.pointA = p
      if (Math.hypot(e.clientX - grab.x0, e.clientY - grab.y0) > 6) grab.moved = true
      return
    }
    if (e.pointerType === 'mouse') {
      const i = hit(p)
      opts.onHover(i < 0 ? null : i)
      box.style.cursor = i < 0 ? '' : 'grab'
    }
  }
  const onUp = () => {
    if (!grab) return
    Composite.remove(world, grab.c)
    if (!grab.moved && performance.now() - grab.t0 < 320) opts.onTap(grab.i)
    grab = null
    delete box.dataset.grabbing
  }
  // touch: only a touch that lands on a frame stops the page from scrolling
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0]
    if (t && hit(local(t)) >= 0) e.preventDefault()
  }
  box.addEventListener('pointerdown', onDown)
  box.addEventListener('pointermove', onMove)
  box.addEventListener('pointerup', onUp)
  box.addEventListener('pointercancel', onUp)
  box.addEventListener('pointerleave', () => opts.onHover(null))
  box.addEventListener('touchstart', onTouchStart, { passive: false })

  // ── size changes: rebuild the walls around the new box
  const ro = new ResizeObserver(() => {
    const w = box.clientWidth
    const h = box.clientHeight
    if (w === W && h === H) return
    Body.setPosition(walls[0]!, { x: w / 2, y: h + T / 2 })
    Body.setPosition(walls[2]!, { x: w + T / 2, y: h / 2 - h })
    W = w
    H = h
  })
  ro.observe(box)

  // ── loop (only while on screen)
  let visible = false
  const io = new IntersectionObserver(([en]) => (visible = !!en?.isIntersecting))
  io.observe(box)
  let raf = 0
  let last = performance.now()
  const positions = bodies.map(() => ({ x: 0, y: 0 }))
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop)
    if (!visible || document.hidden) {
      last = now
      return
    }
    const dt = Math.max(0, Math.min(1000 / 30, now - last))
    last = now
    Engine.update(engine, dt)
    bodies.forEach((b, i) => {
      const el = els[i]
      const s = sizes[i]
      if (!el || !s) return
      el.style.transform = `translate3d(${(b.position.x - s.w / 2).toFixed(1)}px,${(b.position.y - s.h / 2).toFixed(1)}px,0) rotate(${b.angle.toFixed(3)}rad)`
      positions[i]!.x = b.position.x
      positions[i]!.y = b.position.y - s.h * 0.45
    })
    opts.onFrame(positions)
  }
  raf = requestAnimationFrame(loop)
  drop()

  return {
    drop,
    shake() {
      bodies.forEach((b) => {
        Sleeping.set(b, false)
        Body.applyForce(b, b.position, { x: (Math.random() - 0.5) * 0.06 * b.mass, y: -(0.05 + Math.random() * 0.06) * b.mass })
        Body.setAngularVelocity(b, (Math.random() - 0.5) * 0.3)
      })
    },
    tilt(gx, gy) {
      engine.gravity.x = gx
      engine.gravity.y = gy
      bodies.forEach((b) => Sleeping.set(b, false))
    },
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      box.removeEventListener('pointerdown', onDown)
      box.removeEventListener('pointermove', onMove)
      box.removeEventListener('pointerup', onUp)
      box.removeEventListener('pointercancel', onUp)
      box.removeEventListener('touchstart', onTouchStart)
      Composite.clear(world, false)
      Engine.clear(engine)
    },
  }
}
