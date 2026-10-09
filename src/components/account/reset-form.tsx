'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { authClient } from '@/lib/auth-client'

export function ResetForm({ token }: { token: string }) {
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  if (!token) return <p className="text-graphite">Linkul de resetare nu este valid. <Link href="/cont/autentificare" className="text-cobalt underline">Cere unul nou</Link>.</p>
  if (done)
    return (
      <div className="card max-w-md bg-glass p-8 text-center">
        <h1 className="disp text-[34px]">Parola a fost schimbată.</h1>
        <Link href="/cont/autentificare" className="btn btn-primary mt-6">Intră în cont</Link>
      </div>
    )
  return (
    <form
      className="card flex w-full max-w-md flex-col gap-4 bg-glass p-8"
      onSubmit={(e) => {
        e.preventDefault()
        const pw = String(new FormData(e.currentTarget).get('password') ?? '')
        start(async () => {
          const r = await authClient.resetPassword({ newPassword: pw, token })
          if (r.error) setError('Linkul a expirat sau nu este valid. Cere unul nou.')
          else setDone(true)
        })
      }}
    >
      <h1 className="disp text-[34px]">Parolă nouă</h1>
      <input name="password" type="password" minLength={10} required autoComplete="new-password" placeholder="Minimum 10 caractere" aria-label="Parolă nouă" className="field" />
      {error ? <p className="text-[14px] text-err">{error}</p> : null}
      <button disabled={pending} className="btn btn-primary">{pending ? 'Se salvează…' : 'Salvează parola'}</button>
    </form>
  )
}
