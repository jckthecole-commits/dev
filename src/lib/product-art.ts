import type { FrameArtProduct } from '@/components/frame-art'
import type { ProductCard } from './catalog-query'

/** Frame renderer input from any product-shaped record. */
export function artOf(p: Pick<ProductCard, 'shape' | 'lensWidth' | 'lensHeight' | 'bridgeWidth' | 'rim' | 'material' | 'geometry' | 'category'>): FrameArtProduct {
  return { shape: p.shape as FrameArtProduct['shape'], lensWidth: p.lensWidth, lensHeight: p.lensHeight, bridgeWidth: p.bridgeWidth, rim: p.rim, material: p.material as FrameArtProduct['material'], geometry: p.geometry, category: p.category }
}

const METAL_CSS: Record<string, string> = {
  gold: 'linear-gradient(135deg,#F1DFAE,#C59B4E 55%,#7E5F2A)',
  silver: 'linear-gradient(135deg,#F4F6F7,#AEB6BC 55%,#5E676E)',
  gunmetal: 'linear-gradient(135deg,#9AA1A7,#4D545A 55%,#1F2428)',
  black: 'linear-gradient(135deg,#5C6268,#22272B 55%,#0B0E11)',
  rose: 'linear-gradient(135deg,#F6D7CB,#C98F7B 55%,#87563F)',
}

/** CSS background for a colour swatch dot. */
export function swatchCss(s: ProductCard['variants'][number]['swatch']): string {
  if (s.kind === 'metal') return METAL_CSS[s.primary] ?? s.primary
  if (s.kind === 'havana') return `radial-gradient(circle at 30% 35%, ${s.secondary ?? '#C08A45'} 0 18%, transparent 19%), radial-gradient(circle at 70% 65%, ${s.secondary ?? '#C08A45'} 0 14%, transparent 15%), ${s.primary}`
  if (s.kind === 'crystal') return `linear-gradient(135deg, ${s.primary}55, ${s.primary}cc)`
  if (s.kind === 'gradient') return `linear-gradient(180deg, ${s.primary}, ${s.secondary ?? s.primary})`
  if (s.secondary && METAL_CSS[s.secondary]) return `linear-gradient(180deg, ${s.primary} 0 50%, ${s.secondary === 'gold' ? '#C59B4E' : '#AEB6BC'} 50%)`
  return s.primary
}
