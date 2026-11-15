'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { cn } from '@/components/ui'
import type { ActionState } from '@/lib/action'

type Option = { id: string; name: string }

export function Slot({
  value,
  models,
  label,
  assign,
}: {
  value: string
  models: Option[]
  label: string
  assign: (modelId: string) => Promise<ActionState>
}) {
  const [optimistic, setOptimistic] = useOptimistic(value)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <div>
      <select
        aria-label={label}
        value={optimistic}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value
          setError(null)
          start(async () => {
            setOptimistic(next)
            const res = await assign(next)
            if (!res.ok) setError(res.message ?? 'Eroare.')
          })
        }}
        className={cn(
          'h-9 w-36 rounded-md border px-2 text-xs focus:border-accent focus:outline-none',
          optimistic ? 'border-accent/40 bg-accent/10 text-text' : 'border-line bg-panel-2 text-muted',
          error && 'border-bad',
        )}
      >
        <option value="">—</option>
        {models.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
      {error ? <p className="mt-1 w-36 text-[11px] leading-tight text-bad">{error}</p> : null}
    </div>
  )
}
