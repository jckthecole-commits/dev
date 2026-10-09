/**
 * Add-to-cart flourish: a copy of the product art arcs into the header bag,
 * which then gives a small bounce. Purely decorative — skipped under reduced motion.
 */
export function flyToCart(source: Element | null | undefined) {
  if (!source || typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const target = Array.from(document.querySelectorAll<HTMLElement>('[data-cart-icon]')).find((el) => el.getBoundingClientRect().width > 0)
  if (!target) return
  const a = source.getBoundingClientRect()
  const b = target.getBoundingClientRect()
  if (!a.width || !a.height) return

  // outer element travels on X, inner on Y with a different easing: together they draw an arc
  const outer = document.createElement('div')
  outer.setAttribute('aria-hidden', 'true')
  Object.assign(outer.style, { position: 'fixed', left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`, zIndex: '100', pointerEvents: 'none' })
  const inner = document.createElement('div')
  Object.assign(inner.style, { width: '100%', height: '100%', filter: 'drop-shadow(0 12px 18px rgba(13,18,22,.22))' })
  const ghost = source.cloneNode(true) as HTMLElement
  ghost.removeAttribute('id')
  Object.assign(ghost.style, { width: '100%', height: '100%', opacity: '1', margin: '0' })
  inner.append(ghost)
  outer.append(inner)
  document.body.append(outer)

  const dx = b.left + b.width / 2 - (a.left + a.width / 2)
  const dy = b.top + b.height / 2 - (a.top + a.height / 2)
  const end = Math.max(0.06, 28 / a.width)
  const duration = 950
  outer.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px)` }], { duration, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'forwards' })
  const fly = inner.animate(
    [
      { transform: 'translateY(0) scale(1) rotate(0deg)', opacity: 1 },
      { transform: `translateY(${Math.min(-60, dy * 0.15 - 60)}px) scale(${(1 + end) / 2}) rotate(-6deg)`, opacity: 1, offset: 0.35 },
      { transform: `translateY(${dy}px) scale(${end}) rotate(-14deg)`, opacity: 0.4 },
    ],
    { duration, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' },
  )
  fly.finished
    .catch(() => undefined)
    .then(() => {
      outer.remove()
      target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.28) rotate(-6deg)' }, { transform: 'scale(.94)' }, { transform: 'scale(1)' }], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' })
    })
}
