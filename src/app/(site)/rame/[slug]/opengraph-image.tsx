import { ImageResponse } from 'next/og'
import type { Swatch } from '@/lib/db/schema'
import { frameDataUri, frameLayout, type FrameSpec } from '@/lib/frame-geometry'
import { formatPrice } from '@/lib/format'
import { artOf } from '@/lib/product-art'
import { getProductBySlug } from '@/server/catalog'
import { OG, OG_SIZE, OgWordmark, ogFonts } from '@/server/og'

export const alt = 'Rama la scară reală, cu dimensiuni și preț'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const p = await getProductBySlug(slug)
  const fonts = await ogFonts()
  if (!p) return new ImageResponse(<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: OG.fog }}><OgWordmark size={44} /></div>, { ...size, fonts })
  const v = p.variants.find((x) => x.isDefault) ?? p.variants[0]
  const spec = artOf(p) as FrameSpec
  const [, , vw, vh] = frameLayout(spec).viewBox
  const w = 820
  const h = Math.round((w * vh) / vw)
  const art = v ? frameDataUri(spec, v.swatch as Swatch, { shadow: true, temples: true, idSalt: 'og' }) : null
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: OG.fog, padding: '56px 72px', fontFamily: 'Atkinson', color: OG.ink }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <OgWordmark size={24} />
          <span style={{ fontFamily: 'Atkinson Mono', fontSize: 19, letterSpacing: 2, color: OG.graphite, textTransform: 'uppercase' }}>{p.category === 'sun' ? 'Ochelari de soare' : 'Ramă de vedere'}</span>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{art ? <img src={art} width={w} height={h} alt="" /> : null}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: 'Mona Sans', fontWeight: 800, fontSize: 64, letterSpacing: -1.5, lineHeight: 1 }}>{p.name}</div>
            <div style={{ marginTop: 12, fontFamily: 'Atkinson Mono', fontSize: 22, color: OG.graphite, letterSpacing: 1 }}>{`${p.lensWidth} · ${p.bridgeWidth} · ${p.templeLength} mm${v ? `  —  ${v.colorName}` : ''}${p.variants.length > 1 ? ` +${p.variants.length - 1}` : ''}`}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: 22, color: OG.graphite }}>de la</span>
            <span style={{ fontFamily: 'Mona Sans', fontWeight: 800, fontSize: 52, color: OG.cobalt }}>{formatPrice(p.price)}</span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  )
}
