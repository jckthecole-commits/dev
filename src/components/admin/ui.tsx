import Link from 'next/link'
import { Icon, type IconName } from '@/components/icons'
import { cn } from '@/lib/cn'

export function PageHeader({ title, eyebrow, actions, children }: { title: string; eyebrow?: string; actions?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <div className="eyebrow mb-2">{eyebrow}</div> : null}
        <h1 className="disp text-[clamp(30px,3.2vw,44px)]">{title}</h1>
        {children}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export function Panel({ title, action, children, className, pad = true }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cn('rounded-[20px] bg-glass ring-1 ring-line-soft', className)}>
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
          <h2 className="text-[15.5px] font-bold">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className={pad ? 'p-5' : ''}>{children}</div>
    </section>
  )
}

const TONES = {
  neutral: 'bg-line-soft text-ink',
  info: 'bg-cobalt-50 text-cobalt',
  warn: 'bg-warn-50 text-warn',
  ok: 'bg-ok-50 text-ok',
  err: 'bg-err-50 text-err',
} as const
export type Tone = keyof typeof TONES

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-bold', TONES[tone], className)}>{children}</span>
}

/** KPI tile: label · value · signed delta vs a named period. */
export function StatTile({ label, value, delta, deltaLabel = 'față de perioada anterioară', upIsGood = true, href, icon }: { label: string; value: string; delta?: number | null; deltaLabel?: string; upIsGood?: boolean; href?: string; icon?: IconName }) {
  const good = delta === null || delta === undefined ? null : delta === 0 ? null : (delta > 0) === upIsGood
  const body = (
    <div className="flex h-full flex-col rounded-[20px] bg-glass p-5 ring-1 ring-line-soft transition-shadow hover:shadow-[var(--shadow-lift)]">
      <div className="flex items-center justify-between text-[13.5px] text-graphite">
        {label}
        {icon ? <Icon name={icon} size={18} /> : null}
      </div>
      <div className="mt-2 font-display text-[30px] font-bold leading-none tracking-[-0.01em]">{value}</div>
      {delta !== undefined && delta !== null ? (
        <div className={cn('mt-2 text-[12.5px]', good === null ? 'text-graphite' : good ? 'text-ok' : 'text-err')}>
          {delta > 0 ? '▲' : delta < 0 ? '▼' : '•'} {Math.abs(delta).toFixed(0)}% <span className="text-graphite">{deltaLabel}</span>
        </div>
      ) : null}
    </div>
  )
  return href ? (
    <Link href={href} className="block no-underline">
      {body}
    </Link>
  ) : (
    body
  )
}

export function Empty({ icon = 'inbox', title, children }: { icon?: IconName; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-fog text-graphite">
        <Icon name={icon} />
      </span>
      <div className="mt-4 font-bold">{title}</div>
      {children ? <div className="mt-1 max-w-sm text-[14px] text-graphite">{children}</div> : null}
    </div>
  )
}

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full text-[14px] [&_td]:border-t [&_td]:border-line-soft [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-mono [&_th]:text-[11px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-graphite [&_tbody_tr:hover]:bg-paper/70', className)}>{children}</table>
    </div>
  )
}

export function Pagination({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null
  return (
    <nav aria-label="Paginare" className="flex items-center justify-between gap-3 border-t border-line-soft px-4 py-3 text-[13.5px]">
      <span className="text-graphite">
        Pagina {page} din {pages}
      </span>
      <span className="flex gap-2">
        {page > 1 ? <Link href={href(page - 1)} className="btn btn-secondary btn-sm">Înapoi</Link> : null}
        {page < pages ? <Link href={href(page + 1)} className="btn btn-secondary btn-sm">Înainte</Link> : null}
      </span>
    </nav>
  )
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-[13.5px] font-bold">{label}</span>
      {children}
      {hint ? <span className="text-[12.5px] text-graphite">{hint}</span> : null}
    </label>
  )
}

export const input = 'field h-11 text-[14.5px]'
