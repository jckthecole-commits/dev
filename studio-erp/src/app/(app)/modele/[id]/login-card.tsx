'use client'

import { useTransition } from 'react'
import { ActionForm } from '@/components/action-form'
import { Badge, Button, Field, Input } from '@/components/ui'
import type { ActionState } from '@/lib/action'

export function LoginCard({
  login,
  setLogin,
  setActive,
}: {
  login: { email: string; active: boolean } | null
  setLogin: (prev: ActionState, f: FormData) => Promise<ActionState>
  setActive: (active: boolean) => Promise<ActionState>
}) {
  const [pending, start] = useTransition()
  if (!login) {
    return (
      <ActionForm action={setLogin} resetOnSuccess>
        {(s) => (
          <div className="space-y-3">
            <p className="text-sm text-muted">Cu un cont, modelul își vede orarul, încasările și fluturașii.</p>
            <Field label="E-mail de autentificare" error={s.errors?.email}>
              <Input name="email" type="email" required autoComplete="off" />
            </Field>
            <Field label="Parolă inițială" error={s.errors?.password} hint="Minim 10 caractere. Modelul o poate schimba după prima intrare.">
              <Input name="password" type="text" required minLength={10} autoComplete="new-password" />
            </Field>
            <Button type="submit" variant="secondary">Creează cont</Button>
          </div>
        )}
      </ActionForm>
    )
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="break-all">{login.email}</span>
        <Badge tone={login.active ? 'good' : 'bad'}>{login.active ? 'activ' : 'dezactivat'}</Badge>
      </div>
      <ActionForm action={setLogin} resetOnSuccess>
        {(s) => (
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Parolă nouă" error={s.errors?.password} className="min-w-0 flex-1">
              <Input name="password" type="text" required minLength={10} autoComplete="new-password" />
            </Field>
            <Button type="submit" variant="secondary">Schimbă</Button>
          </div>
        )}
      </ActionForm>
      <Button variant={login.active ? 'danger' : 'secondary'} small disabled={pending} onClick={() => start(async () => void (await setActive(!login.active)))}>
        {login.active ? 'Dezactivează contul' : 'Reactivează contul'}
      </Button>
    </div>
  )
}
