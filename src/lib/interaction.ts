/**
 * Runs `cb` once, on the visitor's first real interaction (pointer, touch,
 * wheel, scroll or key). Heavy enhancements (three.js scenes) wait for this,
 * so the first load stays light; the static versions are complete on their own.
 */
const EVENTS = ['pointermove', 'pointerdown', 'touchstart', 'wheel', 'scroll', 'keydown'] as const

let fired = false
const waiting = new Set<() => void>()

function fire() {
  if (fired) return
  fired = true
  for (const e of EVENTS) window.removeEventListener(e, fire, true)
  for (const cb of waiting) cb()
  waiting.clear()
}

export function onFirstInteraction(cb: () => void): () => void {
  if (fired) {
    const id = window.setTimeout(cb, 0)
    return () => window.clearTimeout(id)
  }
  if (!waiting.size) for (const e of EVENTS) window.addEventListener(e, fire, { capture: true, passive: true })
  waiting.add(cb)
  return () => waiting.delete(cb)
}
