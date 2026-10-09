import { estimateThickness, type IndexCode } from '@/lib/optics'

/**
 * Cross-section of a spectacle lens at true scale (mm), computed from the
 * sag formula. Minus lenses are thick at the edge, plus lenses at the centre.
 */
export function LensSection({
  power,
  index,
  frame,
  pd = 63,
  highlight,
  className,
}: {
  power: number
  index: IndexCode
  frame: { lensWidth: number; bridgeWidth: number }
  pd?: number
  highlight?: boolean
  className?: string
}) {
  const t = estimateThickness(power, index, frame, pd)
  const half = frame.lensWidth / 2 + Math.max(0, (frame.lensWidth + frame.bridgeWidth - pd) / 2)
  const w = half * 2
  const base = 0.9 // front-surface sag (mm), purely visual
  const N = 40
  const ex = 2.2 // vertical exaggeration so a 4 mm difference is legible
  const front: [number, number][] = []
  const back: [number, number][] = []
  for (let i = 0; i <= N; i++) {
    const x = -half + (w * i) / N
    const u = (x / half) ** 2
    const yf = -base * (1 - u)
    const th = t.center + (t.edge - t.center) * u
    front.push([x, yf * ex])
    back.push([x, (yf + th) * ex])
  }
  const d = `M${front.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L')}L${back
    .reverse()
    .map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`)
    .join('L')}Z`
  const maxT = 12
  const gid = `ls${index.replace('.', '')}${highlight ? 'h' : ''}`
  return (
    <svg viewBox={`${-half - 2} ${(-base - 1.5) * ex} ${w + 4} ${(maxT + base + 3) * ex}`} className={className} role="img" aria-label={`Indice ${index}: ${t.kind === 'plus' ? 'centru' : 'margine'} ≈ ${t.max.toFixed(1).replace('.', ',')} mm`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={highlight ? '#2638C9' : '#9FB0C2'} stopOpacity={highlight ? 0.28 : 0.35} />
          <stop offset="1" stopColor={highlight ? '#2638C9' : '#DCE4EA'} stopOpacity={highlight ? 0.1 : 0.5} />
        </linearGradient>
      </defs>
      <line x1={-half - 2} x2={half + 2} y1={(maxT + base) * ex} y2={(maxT + base) * ex} stroke="#D3D9D6" strokeWidth="0.25" strokeDasharray="1 1" />
      <path d={d} fill={`url(#${gid})`} stroke={highlight ? '#2638C9' : '#0D1216'} strokeWidth="0.35" strokeLinejoin="round" />
    </svg>
  )
}
