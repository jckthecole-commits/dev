import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Studio ERP', template: '%s · Studio ERP' },
  robots: { index: false, follow: false },
}
export const viewport: Viewport = { themeColor: [{ media: '(prefers-color-scheme: dark)', color: '#1a1c20' }, { media: '(prefers-color-scheme: light)', color: '#ffffff' }] }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  )
}
