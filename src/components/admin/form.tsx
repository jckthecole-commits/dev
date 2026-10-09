'use client'

import { cn } from '@/lib/cn'
import { useActionForm } from '@/lib/use-action-form'

export type FormResult = { ok: boolean; message?: string; error?: string; fieldErrors?: Record<string, string> } | null

/** Admin form wrapper: no reset on error, inline status, sticky submit. */
export function AdminForm({ action, children, submit = 'Salvează', className, inline }: { action: (s: FormResult, fd: FormData) => Promise<FormResult>; children: React.ReactNode; submit?: string; className?: string; inline?: boolean }) {
  const [state, onSubmit, pending] = useActionForm(action, null)
  return (
    <form onSubmit={onSubmit} className={cn(inline ? 'flex flex-wrap items-end gap-3' : 'flex flex-col gap-5', className)}>
      {children}
      {state?.fieldErrors ? (
        <ul className="rounded-xl bg-err-50 p-3 text-[13.5px] text-err">
          {Object.entries(state.fieldErrors).map(([k, v]) => (
            <li key={k}>
              <strong>{k}</strong>: {v}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={cn('btn btn-sm', inline ? 'btn-secondary' : 'btn-primary')}>
          {pending ? 'Se salvează…' : submit}
        </button>
        {state ? <span role="status" className={cn('text-[13.5px]', state.ok ? 'text-ok' : 'text-err')}>{state.ok ? (state.message ?? 'Salvat.') : state.error}</span> : null}
      </div>
    </form>
  )
}
