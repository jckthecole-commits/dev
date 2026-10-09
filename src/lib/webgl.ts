/** Whether the heavy WebGL extras should run: a context is available, motion is welcome, no Save-Data. */
export function canRunWebgl(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return false
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

let cached: boolean | null = null
/** useSyncExternalStore snapshot (the answer never changes during a visit). */
export const webglSnapshot = () => (cached ??= canRunWebgl())
export const webglServerSnapshot = () => false
export const noSubscribe = () => () => {}
