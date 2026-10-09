import Link from 'next/link'
import { cn } from '@/lib/cn'
import { WORDMARK as W } from './wordmark-paths'

/** „Sifra Vision” wordmark — outlines from Mona Sans (no extra font weights to load); the O is a lens with its cobalt reflection. */
export function Wordmark({ className, size = 22, href = '/', label = 'Sifra Vision — acasă', inverted = false }: { className?: string; size?: number; href?: string | null; label?: string; inverted?: boolean }) {
  const ink = inverted ? '#EEF1EF' : 'currentColor'
  const k = size / W.em
  const mark = (
    <svg
      viewBox={`0 ${W.top} ${W.width} ${W.height}`}
      width={Math.round(W.width * k)}
      height={Math.round(W.height * k)}
      className={cn('block shrink-0', className)}
      {...(href ? { 'aria-hidden': true } : { role: 'img', 'aria-label': 'Sifra Vision' })}
    >
      <path d={W.bold} fill={ink} />
      <path d={W.light} fill={ink} />
      <circle cx={W.ring.cx} cy={W.ring.cy} r={W.ring.r} fill="none" stroke={ink} strokeWidth={W.ring.stroke} />
      <path d={W.ring.arc} fill="none" stroke="#2638C9" strokeWidth={W.ring.stroke} strokeLinecap="round" />
    </svg>
  )
  if (!href) return mark
  return (
    <Link href={href} aria-label={label} className="inline-flex text-inherit no-underline">
      {mark}
    </Link>
  )
}

/** Decorative magnifying lens with chromatic fringe — the brand's signature object. */
export function LensRing({ size = 300, label, className, style }: { size?: number; label?: string; className?: string; style?: React.CSSProperties }) {
  return (
    <div aria-hidden="true" className={cn('lens-ring pointer-events-none relative', className)} style={{ width: size, height: size, ...style }}>
      <div className="absolute left-1/2 top-1/2 size-1.5 -translate-1/2 rounded-full bg-cobalt" />
      <div
        className="absolute left-[22%] top-[10%] h-[16%] w-[34%] rotate-[-24deg] rounded-full"
        style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,.65), rgba(255,255,255,0))' }}
      />
      {label ? <div className="eyebrow absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-ink">{label}</div> : null}
    </div>
  )
}
