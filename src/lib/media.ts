import media from './media.json'

/**
 * Campaign media generated for the site (scripts/media/build.mjs → public/media). Every
 * entry is optional: a section without its media keeps its drawn/CSS version.
 */
export type MediaImage = { kind: 'image'; dir: string; w: number; h: number; widths: number[]; blur?: number; alt?: string }
export type MediaVideo = { kind: 'video'; dir: string; w: number; h: number; mw: number; mh: number; duration: number; endPoster: boolean }

const all = media as Record<string, MediaImage | MediaVideo>

export function mediaImage(id: string): MediaImage | null {
  const m = all[id]
  return m?.kind === 'image' ? m : null
}
export function mediaVideo(id: string): MediaVideo | null {
  const m = all[id]
  return m?.kind === 'video' ? m : null
}

export const srcSet = (m: MediaImage, ext: 'avif' | 'webp') => m.widths.map((w) => `${m.dir}/${w}.${ext} ${w}w`).join(', ')
export const largest = (m: MediaImage, ext: 'avif' | 'webp' = 'webp') => `${m.dir}/${m.widths[m.widths.length - 1]}.${ext}`
