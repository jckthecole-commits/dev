'use client'

import { useState, useTransition } from 'react'
import { ActionForm } from '@/components/action-form'
import { Button, Field, Input, Select } from '@/components/ui'
import type { ActionState } from '@/lib/action'

type Action = (p: ActionState, f: FormData) => Promise<ActionState>
const ROLE_OPTIONS = [
  ['trainer', 'Trainer'],
  ['manager', 'Manager'],
  ['admin', 'Administrator'],
] as const

export function AddMemberForm({ action }: { action: Action }) {
  return (
    <ActionForm action={action} resetOnSuccess>
      {(s) => {
        const e = s.errors ?? {}
        return (
          <div className="grid gap-3">
            <Field label="Nume" error={e.name}><Input name="name" required /></Field>
            <Field label="E-mail" error={e.email}><Input name="email" type="email" required autoComplete="off" /></Field>
            <Field label="Telefon" error={e.phone}><Input name="phone" type="tel" /></Field>
            <Field label="Rol" error={e.role}>
              <Select name="role" defaultValue="trainer">
                {ROLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Parolă inițială" error={e.password} hint="Minim 10 caractere.">
              <Input name="password" type="text" required minLength={10} autoComplete="new-password" />
            </Field>
            <div><Button type="submit">Adaugă</Button></div>
          </div>
        )
      }}
    </ActionForm>
  )
}

export function MemberRow({
  member,
  isSelf,
  updateRole,
  setActive,
  resetPassword,
}: {
  member: { name: string; email: string; role: string; active: boolean; phone: string | null; models: number }
  isSelf: boolean
  updateRole: Action
  setActive: (active: boolean) => Promise<ActionState>
  resetPassword: Action
}) {
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)
  return (
    <li className="space-y-3 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">
            {member.name} {isSelf ? <span className="text-xs text-muted">(tu)</span> : null} {!member.active ? <span className="text-xs text-bad">dezactivat</span> : null}
          </div>
          <div className="break-all text-sm text-muted">{member.email}{member.phone ? ` · ${member.phone}` : ''}{member.models ? ` · ${member.models} ${member.models === 1 ? 'model' : 'modele'} în grijă` : ''}</div>
        </div>
        <ActionForm action={updateRole} className="flex items-center gap-2">
          <Select name="role" defaultValue={member.role} className="h-8 w-auto text-xs" aria-label={`Rol ${member.name}`} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
            {ROLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </ActionForm>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" small onClick={() => setShowPw((v) => !v)}>Parolă nouă</Button>
        {!isSelf ? (
          <Button
            variant={member.active ? 'danger' : 'secondary'}
            small
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await setActive(!member.active)
                setErr(r.ok ? null : (r.message ?? 'Eroare'))
              })
            }
          >
            {member.active ? 'Dezactivează' : 'Reactivează'}
          </Button>
        ) : null}
      </div>
      {err ? <p className="text-sm text-bad">{err}</p> : null}
      {showPw ? (
        <ActionForm action={resetPassword} resetOnSuccess className="flex flex-wrap items-end gap-2">
          <Field label="Parolă nouă (minim 10 caractere)" className="min-w-0 flex-1">
            <Input name="password" type="text" required minLength={10} autoComplete="new-password" />
          </Field>
          <Button type="submit" variant="secondary">Salvează</Button>
        </ActionForm>
      ) : null}
    </li>
  )
}
