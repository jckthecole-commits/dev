import Link from 'next/link'
import { cn } from '@/lib/cn'

/** „Sifra Vision” wordmark — two words, legible & searchable; the O is a lens with its cobalt reflection. */
export function Wordmark({ className, size = 22, href = '/', label = 'Sifra Vision — acasă', inverted = false }: { className?: string; size?: number; href?: string | null; label?: string; inverted?: boolean }) {
  const ink = inverted ? '#EEF1EF' : 'currentColor'
  const mark = (
    <span className={cn('inline-flex items-center whitespace-nowrap leading-none', className)} style={{ fontSize: size }}>
      <span className="disp-wide font-bold tracking-[0.14em]">SIFRA</span>
      <span className="disp-wide ml-[0.45em] font-light tracking-[0.14em]">VISI</span>
      <svg width="0.92em" height="0.92em" viewBox="0 0 20 20" aria-hidden="true" className="mx-[0.12em] shrink-0">
        <circle cx="10" cy="10" r="8.2" fill="none" stroke={ink} strokeWidth="1.6" />
        <path d="M5.5 7.2 A5.5 5.5 0 0 1 9 4.6" fill="none" stroke="#2638C9" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span className="disp-wide font-light tracking-[0.14em]">N</span>
    </span>
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
