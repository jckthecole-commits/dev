import { ImageResponse } from 'next/og'
import { getPost } from '@/server/content'
import { OG, OG_SIZE, OgWordmark, ogFonts } from '@/server/og'

export const alt = 'Articol din jurnalul Sifra Vision'
export const size = OG_SIZE
export const contentType = 'image/png'

/** Eye-chart rows fading out — the brand's "from blur to sharp" motif. */
const ROWS = ['E', 'F P', 'T O Z', 'L P E D', 'P E C F D']

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug, 'article')
  const title = post?.title ?? 'Jurnal Sifra Vision'
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: OG.fog, padding: '60px 72px', fontFamily: 'Atkinson', color: OG.ink }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, paddingRight: 48 }}>
          <OgWordmark size={24} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontFamily: 'Atkinson Mono', fontSize: 20, letterSpacing: 3, textTransform: 'uppercase', color: OG.cobalt }}>{post?.category ?? 'Jurnal'}{post?.readingMinutes ? ` · ${post.readingMinutes} min` : ''}</span>
            <span style={{ marginTop: 18, fontFamily: 'Mona Sans', fontWeight: 800, fontSize: title.length > 60 ? 54 : 64, lineHeight: 1.02, letterSpacing: -1.5 }}>{title}</span>
          </div>
          <span style={{ fontSize: 22, color: OG.graphite }}>sifravision.ro/jurnal</span>
        </div>
        <div style={{ width: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderLeft: `2px solid ${OG.line}` }}>
          {ROWS.map((r, i) => (
            <span key={r} style={{ fontFamily: 'Mona Sans', fontWeight: 800, fontSize: 96 - i * 17, letterSpacing: 10 - i, color: OG.ink, opacity: 1 - i * 0.17, lineHeight: 1.15 }}>{r}</span>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  )
}
