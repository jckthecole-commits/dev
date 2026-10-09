import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'

/* Self-hosted, subset fonts (Latin + Romanian, no hinting) — built by scripts/build-fonts.py,
   licences in src/fonts. ~60 KB for the whole first paint instead of ~300 KB.
   Display: Mona Sans pinned at 740 / width 112 (renamed, per its Reserved Font Name).
   Text: Atkinson Hyperlegible Next — designed by the Braille Institute for low-vision readers. Specs: its mono sibling.
   Accent: Bodoni Moda italic — the fashion half of the voice, used for single words. */
const display = localFont({ src: '../fonts/display.woff2', weight: '600 900', variable: '--font-mona', display: 'swap', adjustFontFallback: 'Arial', declarations: [{ prop: 'font-stretch', value: '75% 125%' }] })
/* the same face with its width axis, for the kinetic type below the fold — attached after load (see SiteEnhancements) */
const displayFlex = localFont({ src: '../fonts/display-wdth.woff2', weight: '600 900', variable: '--font-mona-flex', display: 'swap', preload: false, adjustFontFallback: false, declarations: [{ prop: 'font-stretch', value: '90% 125%' }] })
const text = localFont({
  src: [
    { path: '../fonts/text-400.woff2', weight: '300 500' },
    { path: '../fonts/text-700.woff2', weight: '600 800' },
  ],
  variable: '--font-text',
  display: 'swap',
  adjustFontFallback: 'Arial',
})
const serif = localFont({ src: '../fonts/serif-italic.woff2', style: 'italic', weight: '400 700', variable: '--font-bodoni', display: 'swap', adjustFontFallback: 'Times New Roman' })
const code = localFont({ src: '../fonts/mono-400.woff2', weight: '300 600', variable: '--font-code', display: 'swap', adjustFontFallback: false, fallback: ['ui-monospace', 'monospace'] })

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
    <html lang="ro" className={`${display.variable} ${displayFlex.variable} ${text.variable} ${code.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  )
}
