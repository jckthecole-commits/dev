import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'

/* Self-hosted variable fonts, subset to Latin + Romanian (built by scripts/build-fonts.py,
   licences in src/fonts): every weight and Mona's width axis, ~120 KB for all three.
   Display: Mona Sans (renamed, per its Reserved Font Name) — the accent words are its oblique.
   Text: Atkinson Hyperlegible Next — designed by the Braille Institute for low-vision readers. Specs: its mono sibling. */
const display = localFont({ src: '../fonts/display.woff2', weight: '200 900', variable: '--font-mona', display: 'swap', adjustFontFallback: 'Arial', declarations: [{ prop: 'font-stretch', value: '75% 125%' }] })
const text = localFont({ src: '../fonts/text.woff2', weight: '200 800', variable: '--font-text', display: 'swap', adjustFontFallback: 'Arial' })
const code = localFont({ src: '../fonts/mono.woff2', weight: '200 800', variable: '--font-code', display: 'swap', adjustFontFallback: false, fallback: ['ui-monospace', 'monospace'] })

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: 'Sifra Vision — rame de vedere și ochelari de soare, Galați', template: '%s · Sifra Vision' },
  description:
    'Rame de vedere și ochelari de soare cu lentile pe dioptria ta. Probă virtuală, preț complet calculat pe loc, rețetă verificată de optometrist. Showroom în Galați, livrare în toată România.',
  applicationName: 'Sifra Vision',
  authors: [{ name: 'Sifra Vision' }],
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: { type: 'website', locale: 'ro_RO', siteName: 'Sifra Vision' },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
}

export const viewport: Viewport = {
  themeColor: '#EEF1EF',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={`${display.variable} ${text.variable} ${code.variable}`}>
      <body>{children}</body>
    </html>
  )
}
