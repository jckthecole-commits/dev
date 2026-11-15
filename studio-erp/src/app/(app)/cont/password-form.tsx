'use client'

import { useRef, useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { Button, Field, Input } from '@/components/ui'

export function PasswordForm() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, setPending] = useState(false)
  const ref = useRef<HTMLFormElement>(null)
  return (
    <form
      ref={ref}
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault()
        const f = new FormData(e.currentTarget)
        const next = String(f.get('next'))
        if (next !== String(f.get('confirm'))) return setMsg({ ok: false, text: 'Parolele noi nu coincid.' })
        if (next.length < 10) return setMsg({ ok: false, text: 'Parola nouă trebuie să aibă minim 10 caractere.' })
        setPending(true)
        const res = await authClient.changePassword({ currentPassword: String(f.get('current')), newPassword: next, revokeOtherSessions: true })
        setPending(false)
        if (res.error) return setMsg({ ok: false, text: 'Parola actuală e greșită.' })
        ref.current?.reset()
        setMsg({ ok: true, text: 'Parola a fost schimbată. Celelalte sesiuni au fost închise.' })
      }}
    >
      <Field label="Parola actuală"><Input name="current" type="password" autoComplete="current-password" required /></Field>
      <Field label="Parola nouă"><Input name="next" type="password" autoComplete="new-password" required minLength={10} /></Field>
      <Field label="Repetă parola nouă"><Input name="confirm" type="password" autoComplete="new-password" required minLength={10} /></Field>
      {msg ? <p className={msg.ok ? 'text-sm text-good' : 'text-sm text-bad'} role="status">{msg.text}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? 'Se salvează…' : 'Schimbă parola'}</Button>
    </form>
  )
}
