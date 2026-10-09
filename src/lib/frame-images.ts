import type { Swatch } from '@/lib/db/schema'
import { shortHash } from '@/lib/hash'

/**
 * URLs of the generated frame drawings (SVG, served once and cached forever —
 * the `v` key changes whenever the geometry or the colour does). Cards use these
 * as plain <img>, so the browser decodes them off the main thread and the page
 * hydrates without thousands of SVG nodes.
 */
export function frameImageSrc(slug: string, colorSlug: string, key: unknown): string {
  return `/imagini/rame/${slug}/${colorSlug}.svg?v=${shortHash(JSON.stringify(key))}`
}

export function shapeIconSrc(shape: string, color = '0D1216'): string {
  return `/imagini/forme/${shape}.svg?c=${color}`
}

export type FrameImageKey = { art: unknown; swatch: Swatch }
