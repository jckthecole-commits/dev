import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Shared pieces for generated social images (next/og). Fonts come from the
 * @fontsource packages (WOFF — Satori does not read WOFF2); both the latin and
 * latin-ext subsets are loaded so Romanian diacritics (ă â î ș ț) render.
 */
export const OG_SIZE = { width: 1200, height: 630 }
export const OG = { fog: '#EEF1EF', glass: '#F8F9F8', ink: '#0D1216', graphite: '#4A545B', cobalt: '#2638C9', line: '#D3D9D6' }

const dir = (pkg: string) => path.join(process.cwd(), 'node_modules', '@fontsource', pkg, 'files')
const FILES = [
  ['Mona Sans', 800, 'mona-sans', 'mona-sans-latin-800-normal.woff'],
  ['Mona Sans', 800, 'mona-sans', 'mona-sans-latin-ext-800-normal.woff'],
  ['Mona Sans', 300, 'mona-sans', 'mona-sans-latin-300-normal.woff'],
  ['Atkinson', 400, 'atkinson-hyperlegible-next', 'atkinson-hyperlegible-next-latin-400-normal.woff'],
  ['Atkinson', 400, 'atkinson-hyperlegible-next', 'atkinson-hyperlegible-next-latin-ext-400-normal.woff'],
  ['Atkinson', 700, 'atkinson-hyperlegible-next', 'atkinson-hyperlegible-next-latin-700-normal.woff'],
  ['Atkinson', 700, 'atkinson-hyperlegible-next', 'atkinson-hyperlegible-next-latin-ext-700-normal.woff'],
  ['Atkinson Mono', 400, 'atkinson-hyperlegible-mono', 'atkinson-hyperlegible-mono-latin-400-normal.woff'],
  ['Atkinson Mono', 400, 'atkinson-hyperlegible-mono', 'atkinson-hyperlegible-mono-latin-ext-400-normal.woff'],
  ['Mona Sans', 300, 'mona-sans', 'mona-sans-latin-ext-300-normal.woff'],
] as const

let cache: Promise<{ name: string; data: Buffer; weight: 300 | 400 | 700 | 800; style: 'normal' }[]> | null = null
export function ogFonts() {
  cache ??= Promise.all(FILES.map(async ([name, weight, pkg, file]) => ({ name, weight, style: 'normal' as const, data: await readFile(path.join(dir(pkg), file)) })))
  return cache
}

/** The wordmark: SIFRA bold, VISI·N light, the O drawn as a lens with its cobalt reflection. */
export function OgWordmark({ size = 26, color = OG.ink }: { size?: number; color?: string }) {
  const track = size * 0.14
  return (
    <div style={{ display: 'flex', alignItems: 'center', fontFamily: 'Mona Sans', fontSize: size, letterSpacing: track, color, lineHeight: 1 }}>
      <span style={{ fontWeight: 800 }}>SIFRA</span>
      <span style={{ fontWeight: 300, marginLeft: size * 0.45 }}>VISI</span>
      <svg width={size * 0.92} height={size * 0.92} viewBox="0 0 20 20" style={{ margin: `0 ${size * 0.12}px` }}>
        <circle cx="10" cy="10" r="8.2" fill="none" stroke={color} strokeWidth="1.6" />
        <path d="M5.5 7.2 A5.5 5.5 0 0 1 9 4.6" fill="none" stroke={OG.cobalt} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span style={{ fontWeight: 300 }}>N</span>
    </div>
  )
}
