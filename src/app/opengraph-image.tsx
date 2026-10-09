import { ImageResponse } from 'next/og'
import { frameDataUri, type FrameSpec } from '@/lib/frame-geometry'
import { OG, OG_SIZE, OgWordmark, ogFonts } from '@/server/og'

export const alt = 'Sifra Vision — rame de vedere și ochelari de soare, cu lentile pe dioptria ta'
export const size = OG_SIZE
export const contentType = 'image/png'

const MIRA: FrameSpec = { shape: 'rectangular', lensWidth: 52, lensHeight: 38, bridgeWidth: 18, rim: 'full', material: 'acetat', geometry: { rim: 4.8, bridgeStyle: 'keyhole' }, category: 'optical' }

export default async function Image() {
  const art = frameDataUri(MIRA, { kind: 'havana', primary: '#6E4421', secondary: '#D69A4C' }, { shadow: true, temples: true, idSalt: 'og' })
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: OG.fog, padding: '64px 72px', fontFamily: 'Atkinson', color: OG.ink }}>
        <OgWordmark size={28} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', width: 600 }}>
            <div style={{ fontFamily: 'Mona Sans', fontWeight: 800, fontSize: 76, lineHeight: 0.98, letterSpacing: -2 }}>Când stilul ține pasul cu tine.</div>
            <div style={{ marginTop: 26, fontSize: 27, lineHeight: 1.35, color: OG.graphite }}>Rame și lentile pe dioptria ta, cu preț complet calculat pe loc și rețetă verificată de optometrist.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 440, height: 440, borderRadius: 999, background: OG.glass, border: `2px solid ${OG.line}` }}>
            <img src={art} width={380} height={160} alt="" />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Atkinson Mono', fontSize: 20, letterSpacing: 2, color: OG.graphite, textTransform: 'uppercase' }}>
          <span>Probă virtuală · Showroom Galați</span>
          <span style={{ color: OG.cobalt }}>sifravision.ro</span>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  )
}
