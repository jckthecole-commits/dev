'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/cn'

type Result = { ok: boolean; message?: string; error?: string } | void

/** Runs a bound server action with pending state, optional confirmation and an inline result. */
export function ActionButton({ action, children, className, confirm, variant = 'secondary' }: { action: () => Promise<Result>; children: React.ReactNode; className?: string; confirm?: string; variant?: 'primary' | 'secondary' | 'ink' | 'danger' | 'ghost' }) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const cls = { primary: 'btn-primary', secondary: 'btn-secondary', ink: 'btn-ink', ghost: 'btn-ghost', danger: 'bg-err text-white hover:bg-[#8c1f1f]' }[variant]
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return
          start(async () => {
            const r = await action()
            if (r && (r.message || r.error)) setMsg({ ok: r.ok, text: r.message ?? r.error ?? '' })
          })
        }}
        className={cn('btn btn-sm', cls, className)}
      >
        {pending ? 'Se procesează…' : children}
      </button>
      {msg ? <span className={cn('text-[12.5px]', msg.ok ? 'text-ok' : 'text-err')}>{msg.text}</span> : null}
    </span>
  )
}
