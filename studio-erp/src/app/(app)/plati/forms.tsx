'use client'

import { useTransition } from 'react'
import { ActionForm } from '@/components/action-form'
import { Button, Field, Input, Select } from '@/components/ui'
import type { ActionState } from '@/lib/action'

type Action = (p: ActionState, f: FormData) => Promise<ActionState>

export function AdjustmentForm({ action, models }: { action: Action; models: { id: string; name: string }[] }) {
  return (
    <ActionForm action={action} resetOnSuccess>
      {(s) => {
        const e = s.errors ?? {}
        return (
          <div className="grid gap-3">
            <Field label="Model" error={e.modelId}>
              <Select name="modelId" required defaultValue="">
                <option value="" disabled>Alege…</option>
                {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tip" error={e.kind}>
                <Select name="kind" defaultValue="bonus">
                  <option value="bonus">Bonus (+)</option>
                  <option value="advance">Avans (−)</option>
                  <option value="deduction">Reținere (−)</option>
                </Select>
              </Field>
              <Field label="Sumă (USD)" error={e.amount}>
                <Input name="amount" inputMode="decimal" required />
              </Field>
            </div>
            <Field label="Notă">
              <Input name="note" placeholder="ex. avans 10 nov." />
            </Field>
            <div><Button type="submit" variant="secondary">Adaugă</Button></div>
          </div>
        )
      }}
    </ActionForm>
  )
}

export function CloseMonthForm({ action, defaultRate, label }: { action: Action; defaultRate: string; label: string }) {
  return (
    <ActionForm action={action} confirm={`Închizi ${label}? Încasările și ajustările lunii devin needitabile, iar fluturașii se generează cu cursul introdus.`}>
      {(s) => (
        <div className="space-y-3">
          <Field label="Curs USD → RON" error={s.errors?.rate} hint="Cursul cu care plătești luna aceasta.">
            <Input name="rate" inputMode="decimal" defaultValue={defaultRate} required />
          </Field>
          <Button type="submit">Închide luna și generează fluturașii</Button>
        </div>
      )}
    </ActionForm>
  )
}

export function ReopenForm({ action }: { action: Action }) {
  return (
    <ActionForm action={action} confirm="Redeschizi luna? Fluturașii generați se șterg.">
      <Button type="submit" variant="danger" small>Redeschide luna</Button>
    </ActionForm>
  )
}

export function DeleteButton({ remove }: { remove: () => Promise<ActionState> }) {
  const [pending, start] = useTransition()
  return (
    <Button variant="ghost" small disabled={pending} onClick={() => start(async () => void (await remove()))}>
      Șterge
    </Button>
  )
}
