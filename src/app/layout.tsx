import type { Metadata, Viewport } from 'next'
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next, Mona_Sans } from 'next/font/google'
import './globals.css'

/* Display: Mona Sans (variable width 75–125). Text: Atkinson Hyperlegible Next —
   designed by the Braille Institute for low-vision readers. Specs: its mono sibling. */
const mona = Mona_Sans({ subsets: ['latin', 'latin-ext'], axes: ['wdth'], variable: '--font-mona', display: 'swap' })
const text = Atkinson_Hyperlegible_Next({ subsets: ['latin', 'latin-ext'], variable: '--font-text', display: 'swap', adjustFontFallback: false, fallback: ['ui-sans-serif', 'system-ui', 'Arial'] })
const code = Atkinson_Hyperlegible_Mono({ subsets: ['latin', 'latin-ext'], variable: '--font-code', display: 'swap', adjustFontFallback: false, fallback: ['ui-monospace', 'monospace'] })

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
  alternates: { canonical: '/' },
}

export const viewport: Viewport = {
  themeColor: '#EEF1EF',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={`${mona.variable} ${text.variable} ${code.variable}`}>
      <body>{children}</body>
    </html>
  )
}
