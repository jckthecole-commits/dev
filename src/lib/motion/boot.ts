/**
 * The site's motion layer — loaded once, on the visitor's first interaction, so the
 * first paint never waits for it. Everything here enhances markup that is already
 * complete and readable without it:
 *
 *   [data-split]        display headings come into focus character by character
 *   [data-scrub-words]  a paragraph sharpens word by word as it is scrolled through
 *   [data-marquee]      a band whose speed, direction and skew follow the scroll velocity
 *   [data-kinetic]      letters that gain weight and width near the cursor (variable font axes)
 *   [data-cursor]       context label for the lens cursor (desktop)
 *
 * GSAP + ScrollTrigger + SplitText, with Lenis for inertial scrolling on mouse/trackpad.
 */
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText)

type Cleanup = () => void

const fine = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches

export async function boot(): Promise<Cleanup> {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
  const cleanups: Cleanup[] = []

  // ── Lenis drives the scroll on mouse/trackpad; GSAP's ticker drives Lenis
  if (fine()) {
    const { default: Lenis } = await import('lenis')
    const lenis = new Lenis({
      lerp: 0.11,
      anchors: { offset: -88 },
      prevent: (node: HTMLElement) => !!node.closest('dialog, [data-lenis-prevent]'),
    })
    lenis.on('scroll', ScrollTrigger.update)
    const raf = (t: number) => lenis.raf(t * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)
    cleanups.push(() => {
      gsap.ticker.remove(raf)
      lenis.destroy()
    })
    cleanups.push(cursor())
  }

  // ── enhance what is on the page now, and whatever the router mounts later
  let retry = 0
  let tries = 0
  const scan = () => {
    let changed = false
    // a client navigation removed these elements: their triggers go with them
    for (const t of ScrollTrigger.getAll()) {
      if (t.trigger && !t.trigger.isConnected) {
        t.kill()
        changed = true
      }
    }
    let waiting = false
    for (const [selector, enhance] of EFFECTS) {
      for (const el of document.querySelectorAll<HTMLElement>(`${selector}:not([data-motion])`)) {
        // markup React has not hydrated yet is left alone: splitting it first would be a
        // hydration mismatch, and React would throw the section away and render it again
        if (!hydrated(el)) {
          waiting = true
          continue
        }
        enhance(el)
        changed = true
      }
    }
    // positions are measured again only when something was added or removed — a refresh
    // in the middle of a scroll would stop it
    if (changed) ScrollTrigger.refresh()
    window.clearTimeout(retry)
    if (waiting && ++tries < 60) retry = window.setTimeout(scan, 350)
    else if (!waiting) tries = 0
  }
  scan()
  let pending = 0
  const mo = new MutationObserver((records) => {
    // the lens cursor rewrites its own label all the time
    if (records.every((r) => (r.target as Element).closest?.('.lens-cursor'))) return
    window.clearTimeout(pending)
    pending = window.setTimeout(scan, 120)
  })
  mo.observe(document.body, { childList: true, subtree: true })
  cleanups.push(() => {
    mo.disconnect()
    window.clearTimeout(pending)
    window.clearTimeout(retry)
  })

  return () => {
    for (const c of cleanups) c()
    ScrollTrigger.getAll().forEach((t) => t.kill())
  }
}

/** React marks every element it has hydrated (or rendered) with its fiber. */
const hydrated = (el: Element) => Object.keys(el).some((k) => k.startsWith('__reactFiber$'))

const EFFECTS: [string, (el: HTMLElement) => void][] = [
  ['[data-split]', splitReveal],
  ['[data-scrub-words]', scrubWords],
  ['[data-marquee]', marquee],
  ['[data-kinetic]', kinetic],
]

/** Headline focus pull: characters arrive blurred, low and faint, then lock into place. */
function splitReveal(el: HTMLElement) {
  el.dataset.motion = ''
  // already seen (or on screen right now): leave it as it is
  if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return
  el.classList.remove('focus-reveal')
  const split = SplitText.create(el, { type: 'words,chars', wordsClass: 'sx-word', charsClass: 'sx-char', aria: 'auto' })
  gsap.set(split.chars, { opacity: 0, yPercent: 38, filter: 'blur(10px)' })
  gsap.to(split.chars, {
    opacity: 1,
    yPercent: 0,
    filter: 'blur(0px)',
    duration: 1.05,
    ease: 'expo.out',
    stagger: { each: 0.016, from: 'start' },
    scrollTrigger: { trigger: el, start: 'top 92%', once: true },
    onComplete: () => {
      gsap.set(split.chars, { clearProps: 'filter,transform' })
    },
  })
}

/** Manifesto: words go from out-of-focus grey to sharp ink as the paragraph is scrolled through. */
function scrubWords(el: HTMLElement) {
  el.dataset.motion = ''
  const split = SplitText.create(el, { type: 'words', wordsClass: 'sx-word', aria: 'auto' })
  gsap.fromTo(
    split.words,
    { opacity: 0.14, filter: 'blur(5px)' },
    {
      opacity: 1,
      filter: 'blur(0px)',
      ease: 'none',
      stagger: 0.12,
      scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 52%', scrub: 0.6 },
    },
  )
}

/** Marquee: a CSS loop at rest; scrolling speeds it up, reverses it when going up, and leans it. */
function marquee(el: HTMLElement) {
  el.dataset.motion = ''
  const track = el.querySelector<HTMLElement>('[data-marquee-track]')
  const anim = track?.getAnimations()[0]
  if (!track || !anim) return
  const state = { rate: 1, skew: 0 }
  let dir = 1
  const apply = () => {
    anim.playbackRate = state.rate
    el.style.setProperty('--skew', `${state.skew.toFixed(2)}deg`)
  }
  ScrollTrigger.create({
    trigger: el,
    start: 'top bottom',
    end: 'bottom top',
    onUpdate(self) {
      const v = self.getVelocity()
      if (Math.abs(v) > 30) dir = v > 0 ? 1 : -1
      const boost = Math.min(5, Math.abs(v) / 350)
      gsap.to(state, { rate: dir * (1 + boost), skew: gsap.utils.clamp(-9, 9, -v / 180), duration: 0.25, overwrite: true, onUpdate: apply })
      gsap.to(state, { rate: dir, skew: 0, duration: 1.2, delay: 0.25, ease: 'power3.out', onUpdate: apply })
    },
  })
}

/** Variable-font proximity: each letter's weight and width follow how close the cursor is. */
function kinetic(el: HTMLElement) {
  el.dataset.motion = ''
  const split = SplitText.create(el, { type: 'chars', charsClass: 'kx-char', aria: 'auto' })
  const chars = split.chars as HTMLElement[]
  const setters = chars.map((c) => ({ w: gsap.quickTo(c, '--w', { duration: 0.5, ease: 'power3.out' }), s: gsap.quickTo(c, '--s', { duration: 0.6, ease: 'power3.out' }), a: gsap.quickTo(c, '--a', { duration: 0.5, ease: 'power3.out' }) }))
  let visible = false
  const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting))
  io.observe(el)
  const onMove = (e: PointerEvent) => {
    if (!visible) return
    chars.forEach((c, i) => {
      const r = c.getBoundingClientRect()
      const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2))
      const k = Math.exp(-(d * d) / (2 * 190 * 190))
      setters[i]!.w(300 + k * 600)
      setters[i]!.s(80 + k * 45)
      setters[i]!.a(0.07 + k * 0.5)
    })
  }
  // touch: a slow wave rolls through the letters while the footer is on screen
  if (!fine()) {
    const tl = gsap.timeline({ repeat: -1, paused: true })
    chars.forEach((c, i) => tl.to(c, { '--w': 900, '--s': 125, '--a': 0.45, duration: 0.9, yoyo: true, repeat: 1, ease: 'sine.inOut' }, i * 0.12))
    ScrollTrigger.create({ trigger: el, start: 'top bottom', end: 'bottom top', onToggle: (self) => (self.isActive ? tl.play() : tl.pause()) })
  } else window.addEventListener('pointermove', onMove, { passive: true })
}

/** Lens cursor: a ring that trails the pointer, grows over anything clickable and reads [data-cursor]. */
function cursor(): Cleanup {
  const ring = document.createElement('div')
  ring.className = 'lens-cursor'
  ring.setAttribute('aria-hidden', 'true')
  ring.innerHTML = '<span class="lens-cursor__label"></span>'
  document.body.append(ring)
  gsap.set(ring, { xPercent: -50, yPercent: -50 })
  const label = ring.firstElementChild as HTMLElement
  const x = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3.out' })
  const y = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3.out' })
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    ring.dataset.on = ''
    x(e.clientX)
    y(e.clientY)
  }
  const onOver = (e: Event) => {
    const t = e.target as Element | null
    // over a product drawing the card's own loupe is the lens — the cursor steps aside
    if (t?.closest('[data-cursor-hide]')) {
      ring.dataset.mode = 'hide'
      label.textContent = ''
      return
    }
    const labelled = t?.closest<HTMLElement>('[data-cursor]')
    const link = t?.closest('a, button, [role="radio"], summary, label, input, select, textarea')
    if (labelled) {
      ring.dataset.mode = 'label'
      label.textContent = labelled.dataset.cursor ?? ''
    } else if (link) {
      ring.dataset.mode = 'link'
      label.textContent = ''
    } else {
      delete ring.dataset.mode
      label.textContent = ''
    }
  }
  const onLeave = () => delete ring.dataset.on
  const onDown = () => ring.classList.add('is-down')
  const onUp = () => ring.classList.remove('is-down')
  window.addEventListener('pointermove', onMove, { passive: true })
  document.addEventListener('pointerover', onOver, { passive: true })
  document.documentElement.addEventListener('pointerleave', onLeave)
  window.addEventListener('pointerdown', onDown, { passive: true })
  window.addEventListener('pointerup', onUp, { passive: true })
  return () => {
    window.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerover', onOver)
    document.documentElement.removeEventListener('pointerleave', onLeave)
    window.removeEventListener('pointerdown', onDown)
    window.removeEventListener('pointerup', onUp)
    ring.remove()
  }
}
