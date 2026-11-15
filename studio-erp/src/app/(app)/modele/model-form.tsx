'use client'

import { ActionForm } from '@/components/action-form'
import { Button, Field, Input, Select, Textarea } from '@/components/ui'
import type { ActionState } from '@/lib/action'
import { MODEL_STATUS } from './status'

export type ModelValues = {
  stageName: string
  legalName: string
  email: string | null
  phone: string | null
  status: string
  startDate: string | null
  trainerId: string | null
  payoutPlanId: string | null
  iban: string | null
  notes: string | null
}

type Option = { id: string; name: string }

export function ModelForm({
  action,
  values,
  trainers,
  plans,
  submitLabel,
}: {
  action: (prev: ActionState, f: FormData) => Promise<ActionState>
  values?: ModelValues
  trainers: Option[]
  plans: Option[]
  submitLabel: string
}) {
  return (
    <ActionForm action={action}>
      {(state) => {
        const e = state.errors ?? {}
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nume de scenă" error={e.stageName}>
              <Input name="stageName" required defaultValue={values?.stageName} />
            </Field>
            <Field label="Nume din acte" error={e.legalName}>
              <Input name="legalName" required defaultValue={values?.legalName} />
            </Field>
            <Field label="E-mail" error={e.email}>
              <Input name="email" type="email" defaultValue={values?.email ?? ''} />
            </Field>
            <Field label="Telefon" error={e.phone}>
              <Input name="phone" type="tel" defaultValue={values?.phone ?? ''} />
            </Field>
            <Field label="Status" error={e.status}>
              <Select name="status" defaultValue={values?.status ?? 'onboarding'}>
                {Object.entries(MODEL_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Data începerii" error={e.startDate}>
              <Input name="startDate" type="date" defaultValue={values?.startDate ?? ''} />
            </Field>
            <Field label="Trainer" error={e.trainerId}>
              <Select name="trainerId" defaultValue={values?.trainerId ?? ''}>
                <option value="">— niciunul —</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Plan de plată" error={e.payoutPlanId} hint="Gol = planul implicit al studioului.">
              <Select name="payoutPlanId" defaultValue={values?.payoutPlanId ?? ''}>
                <option value="">— implicit —</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="IBAN" error={e.iban} className="sm:col-span-2">
              <Input name="iban" defaultValue={values?.iban ?? ''} autoComplete="off" />
            </Field>
            <Field label="Note interne" error={e.notes} className="sm:col-span-2">
              <Textarea name="notes" defaultValue={values?.notes ?? ''} />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit">{submitLabel}</Button>
            </div>
          </div>
        )
      }}
    </ActionForm>
  )
}
