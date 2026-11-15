'use client'

import { useTransition } from 'react'
import { ActionForm } from '@/components/action-form'
import { Button, Field, Input, Select, Textarea } from '@/components/ui'
import type { ActionState } from '@/lib/action'

type Option = { id: string; name: string }

export function EarningForm({ action, models, platforms, defaultDay }: { action: (p: ActionState, f: FormData) => Promise<ActionState>; models: Option[]; platforms: Option[]; defaultDay: string }) {
  return (
    <ActionForm action={action}>
      {(s) => {
        const e = s.errors ?? {}
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Model" error={e.modelId}>
              <Select name="modelId" required defaultValue="">
                <option value="" disabled>Alege…</option>
                {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </Field>
            <Field label="Platformă" error={e.platformId}>
              <Select name="platformId" required defaultValue={platforms[0]?.id}>
                {platforms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Ziua" error={e.day}>
              <Input name="day" type="date" required defaultValue={defaultDay} />
            </Field>
            <Field label="Sumă (USD)" error={e.amount}>
              <Input name="amount" inputMode="decimal" required placeholder="125,50" />
            </Field>
            <Field label="Minute online (opțional)" error={e.minutes}>
              <Input name="minutes" inputMode="numeric" />
            </Field>
            <div className="flex items-end">
              <Button type="submit">Salvează</Button>
            </div>
          </div>
        )
      }}
    </ActionForm>
  )
}

export function ImportForm({ action }: { action: (p: ActionState, f: FormData) => Promise<ActionState> }) {
  return (
    <ActionForm action={action} resetOnSuccess>
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Prima linie e antetul: <code className="rounded bg-panel-2 px-1">model, platforma, data, suma, minute</code> (minute e opțional). Separator virgulă, punct și virgulă sau tab.
          Modelul se recunoaște după numele de scenă sau după utilizatorul de pe platformă din fișa lui.
        </p>
        <Field label="Fișier CSV">
          <Input name="file" type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="py-1.5" />
        </Field>
        <Field label="…sau lipește conținutul">
          <Textarea name="text" rows={5} placeholder={'model,platforma,data,suma,minute\nLuna,Platforma A,2026-11-14,240.50,360'} className="font-mono text-xs" />
        </Field>
        <Button type="submit" variant="secondary">Importă</Button>
      </div>
    </ActionForm>
  )
}

export function DeleteEarning({ remove }: { remove: () => Promise<ActionState> }) {
  const [pending, start] = useTransition()
  return (
    <Button
      variant="ghost"
      small
      disabled={pending}
      onClick={() => {
        if (window.confirm('Ștergi această încasare?')) start(async () => void (await remove()))
      }}
    >
      Șterge
    </Button>
  )
}
