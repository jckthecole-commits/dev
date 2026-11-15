'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { Button, Field, Input } from '@/components/ui'

export function SignInForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        setPending(true)
        setError(null)
        const res = await authClient.signIn.email({ email: String(data.get('email')), password: String(data.get('password')) })
        if (res.error) {
          setPending(false)
          setError(res.error.status === 429 ? 'Prea multe încercări. Așteaptă un minut.' : 'E-mail sau parolă greșită, ori contul e dezactivat.')
          return
        }
        router.replace('/')
        router.refresh()
      }}
    >
      <Field label="E-mail">
        <Input name="email" type="email" autoComplete="username" required autoFocus />
      </Field>
      <Field label="Parolă">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      {error ? <p className="text-sm text-bad" role="alert">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Se verifică…' : 'Intră'}
      </Button>
    </form>
  )
}
