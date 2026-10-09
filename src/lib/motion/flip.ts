/**
 * GSAP Flip for the catalogue grid: when filters change, cards glide to their new
 * places and newcomers come into focus. Loaded on the first interaction; until then
 * (or with reduced motion) the grid just updates.
 */
type Lib = { gsap: typeof import('gsap').gsap; Flip: typeof import('gsap/Flip').Flip }
type FlipState = ReturnType<Lib['Flip']['getState']>

let lib: Lib | null = null
let loading: Promise<void> | null = null

export function loadFlip(): Promise<void> {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve()
  return (loading ??= Promise.all([import('gsap'), import('gsap/Flip')]).then(([g, f]) => {
    g.gsap.registerPlugin(f.Flip)
    lib = { gsap: g.gsap, Flip: f.Flip }
  }))
}

export function captureFlip(root: Element | null): FlipState | null {
  if (!lib || !root) return null
  return lib.Flip.getState(root.querySelectorAll('[data-flip-id]'))
}

export function playFlip(state: FlipState | null, root: Element | null) {
  if (!lib || !state || !root) return
  const { gsap, Flip } = lib
  Flip.from(state, {
    targets: root.querySelectorAll('[data-flip-id]'),
    duration: 0.75,
    ease: 'expo.inOut',
    stagger: 0.025,
    absolute: false,
    onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.94, filter: 'blur(8px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.6, delay: 0.2, stagger: 0.03, clearProps: 'filter,transform' }),
  })
}
