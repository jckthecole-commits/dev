import { ImageResponse } from 'next/og'
import type { Swatch } from '@/lib/db/schema'
import { frameDataUri, frameLayout, type FrameSpec } from '@/lib/frame-geometry'
import { artOf } from '@/lib/product-art'
import { getProductBySlug } from '@/server/catalog'

/**
 * Square packshot rendered from the frame's real measurements: white
 * background, no text or badges (Google Merchant Center image rules).
 * URL: /imagini/rame/<slug>/<colour-slug>.png — stable, cacheable.
 */
export async function GET(_: Request, { params }: RouteContext<'/imagini/rame/[slug]/[file]'>) {
  const { slug, file } = await params
  const colorSlug = file.replace(/\.png$/, '')
  const p = await getProductBySlug(slug)
  const v = p?.variants.find((x) => x.colorSlug === colorSlug) ?? (colorSlug === 'implicit' ? p?.variants[0] : undefined)
  if (!p || !v) return new Response('Not found', { status: 404 })
  const spec = artOf(p) as FrameSpec
  const [, , vw, vh] = frameLayout(spec).viewBox
  const w = 1040
  const h = Math.round((w * vh) / vw)
  const img = new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF' }}>
        <img src={frameDataUri(spec, v.swatch as Swatch, { shadow: true, temples: true, idSalt: 'pk' })} width={w} height={h} alt="" />
      </div>
    ),
    { width: 1200, height: 1200 },
  )
  img.headers.set('cache-control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400')
  return img
}
