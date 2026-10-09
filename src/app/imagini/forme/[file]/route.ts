import { frameSvgString, type FrameSpec, type Shape } from '@/lib/frame-geometry'
import { SHAPES } from '@/lib/catalog-filters'

const SPEC = (shape: Shape): FrameSpec => ({
  shape,
  lensWidth: 50,
  lensHeight: shape === 'round' ? 46 : shape === 'square' || shape === 'geometric' || shape === 'pilot' ? 44 : 38,
  bridgeWidth: 18,
  rim: 'full',
  material: 'acetat',
  geometry: { rim: 3.2, bridgeStyle: 'keyhole', browWeight: 1.7 },
})

/** Flat silhouette of a frame shape — menu and filter icons. URL: /imagini/forme/<shape>.svg?c=<hex> */
export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  const shape = file.replace(/\.svg$/, '')
  if (!SHAPES.some((s) => s.value === shape)) return new Response('Not found', { status: 404 })
  const c = new URL(req.url).searchParams.get('c') ?? '0D1216'
  const color = /^[0-9a-fA-F]{6}$/.test(c) ? `#${c}` : '#0D1216'
  const svg = frameSvgString(SPEC(shape as Shape), { kind: 'solid', primary: color }, { mode: 'rim', rimColor: color })
  return new Response(svg, { headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=31536000, immutable' } })
}
