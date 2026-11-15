import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div> : null}
    </div>
  )
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-line bg-panel', className)}>
      {title ? (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {actions}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="tabular mt-1 text-2xl font-semibold">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  )
}

const btn = {
  primary: 'bg-accent text-accent-ink hover:brightness-110',
  secondary: 'border border-line bg-panel-2 text-text hover:border-muted',
  danger: 'border border-bad/50 text-bad hover:bg-bad/10',
  ghost: 'text-muted hover:text-text',
}
export type ButtonVariant = keyof typeof btn
export const buttonClass = (variant: ButtonVariant = 'primary', small = false) =>
  cn('inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:opacity-50', small ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm', btn[variant])

export function Button({ variant = 'primary', small, className, ...props }: ComponentProps<'button'> & { variant?: ButtonVariant; small?: boolean }) {
  return <button className={cn(buttonClass(variant, small), className)} {...props} />
}

export function LinkButton({ variant = 'secondary', small, className, ...props }: ComponentProps<typeof Link> & { variant?: ButtonVariant; small?: boolean }) {
  return <Link className={cn(buttonClass(variant, small), className)} {...props} />
}

export const inputClass = 'h-10 w-full rounded-lg border border-line bg-panel-2 px-3 text-sm text-text placeholder:text-muted/70 focus:border-accent focus:outline-none'

export function Field({ label, hint, error, children, className }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-bad">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  )
}

export const Input = ({ className, ...p }: ComponentProps<'input'>) => <input className={cn(inputClass, className)} {...p} />
export const Select = ({ className, ...p }: ComponentProps<'select'>) => <select className={cn(inputClass, className)} {...p} />
export const Textarea = ({ className, ...p }: ComponentProps<'textarea'>) => <textarea className={cn(inputClass, 'h-auto min-h-24 py-2', className)} {...p} />

const tones = { neutral: 'bg-panel-2 text-muted', good: 'bg-good/15 text-good', bad: 'bg-bad/15 text-bad', accent: 'bg-accent/15 text-accent', info: 'bg-info/15 text-info' }
export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', tones[tone])}>{children}</span>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{children}</div>
}

/** Horizontally scrollable table wrapper so wide tables never push the page sideways on a phone. */
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-max border-collapse text-sm [&_td]:border-t [&_td]:border-line [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:pb-2 [&_th:not(.text-right)]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted">
        {children}
      </table>
    </div>
  )
}

/** ‹ label › navigation between periods (week, month), kept as plain links. */
export function PeriodNav({ prev, next, label, current }: { prev: string; next: string; label: string; current?: string }) {
  return (
    <div className="flex items-center gap-1">
      <LinkButton href={prev} small aria-label="Perioada anterioară">‹</LinkButton>
      <span className="min-w-36 px-2 text-center text-sm font-medium capitalize">{label}</span>
      <LinkButton href={next} small aria-label="Perioada următoare">›</LinkButton>
      {current ? <LinkButton href={current} small variant="ghost">Azi</LinkButton> : null}
    </div>
  )
}
