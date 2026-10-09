import 'server-only'

/** Brand lens mark for raster icons (apple-touch, PWA). `pad` shrinks it into the maskable safe zone. */
export function AppIcon({ size, pad = 0.18, radius = 0.22 }: { size: number; pad?: number; radius?: number }) {
  const inner = size * (1 - pad * 2)
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EEF1EF', borderRadius: size * radius }}>
      <svg width={inner} height={inner} viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="16" fill="none" stroke="#0D1216" strokeWidth="4" />
        <path d="M11.3 14.7A10.6 10.6 0 0 1 18 9.6" fill="none" stroke="#2638C9" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </div>
  )
}
