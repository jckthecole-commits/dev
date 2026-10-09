'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Icon } from '@/components/icons'
import { authClient } from '@/lib/auth-client'
import { cn } from '@/lib/cn'

type Mode = 'login' | 'register' | 'forgot'

const MSG: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'E-mailul sau parola nu sunt corecte.',
  USER_ALREADY_EXISTS: 'Există deja un cont cu acest e-mail. Intră în cont sau resetează parola.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Există deja un cont cu acest e-mail.',
  PASSWORD_TOO_SHORT: 'Parola trebuie să aibă cel puțin 10 caractere.',
  INVALID_EMAIL: 'Adresa de e-mail nu pare corectă.',
}

export function AuthForm({ next, google }: { next: string; google: boolean }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const email = String(f.get('email') ?? '').trim()
    const password = String(f.get('password') ?? '')
    setError(null)
    setInfo(null)
    start(async () => {
      if (mode === 'login') {
        const r = await authClient.signIn.email({ email, password })
        if (r.error) return setError(MSG[r.error.code ?? ''] ?? r.error.message ?? 'Autentificarea a eșuat.')
      } else if (mode === 'register') {
        const r = await authClient.signUp.email({ email, password, name: String(f.get('name') ?? '').trim() || email.split('@')[0]! })
        if (r.error) return setError(MSG[r.error.code ?? ''] ?? r.error.message ?? 'Înregistrarea a eșuat.')
      } else {
        await authClient.requestPasswordReset({ email, redirectTo: '/cont/resetare-parola' })
        return setInfo('Dacă există un cont cu acest e-mail, îți trimitem un link de resetare.')
      }
      router.replace(next)
      router.refresh()
    })
  }

  return (
    <div className="card w-full max-w-md bg-glass p-7 sm:p-8">
      <div className="flex gap-1 rounded-full bg-fog p-1" role="tablist">
        {(
          [
            ['login', 'Intră în cont'],
            ['register', 'Cont nou'],
          ] as const
        ).map(([m, label]) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null) }} className={cn('flex-1 rounded-full py-2.5 text-[14.5px] font-bold transition-colors', mode === m ? 'bg-paper shadow-sm' : 'text-graphite')}>
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        {mode === 'register' ? (
          <label className="flex flex-col gap-1.5 text-[14px] font-bold">
            Nume
            <input id="auth-name" name="name" autoComplete="name" required className="field font-normal" />
          </label>
        ) : null}
        <label className="flex flex-col gap-1.5 text-[14px] font-bold">
          E-mail
          <input id="auth-email" name="email" type="email" autoComplete="email" required className="field font-normal" />
        </label>
        {mode !== 'forgot' ? (
          <label className="flex flex-col gap-1.5 text-[14px] font-bold">
            Parolă
            <input id="auth-password" name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 10 : undefined} required className="field font-normal" />
            {mode === 'register' ? <span className="text-[12.5px] font-normal text-graphite">Minimum 10 caractere.</span> : null}
          </label>
        ) : null}
        {error ? <p role="alert" className="flex items-start gap-2 rounded-xl bg-err-50 px-3.5 py-2.5 text-[14px] text-err"><Icon name="alert" size={18} className="mt-0.5 shrink-0" /> {error}</p> : null}
        {info ? <p role="status" className="rounded-xl bg-ok-50 px-3.5 py-2.5 text-[14px] text-ok">{info}</p> : null}
        <button type="submit" disabled={pending} className="btn btn-primary w-full">
          {pending ? 'Un moment…' : mode === 'login' ? 'Intră în cont' : mode === 'register' ? 'Creează contul' : 'Trimite linkul de resetare'}
        </button>
        {mode === 'login' ? (
          <button type="button" onClick={() => setMode('forgot')} className="text-[14px] text-cobalt hover:underline">
            Am uitat parola
          </button>
        ) : mode === 'forgot' ? (
          <button type="button" onClick={() => setMode('login')} className="text-[14px] text-cobalt hover:underline">
            Înapoi la autentificare
          </button>
        ) : null}
      </form>
      {google && mode !== 'forgot' ? (
        <>
          <div className="my-6 flex items-center gap-3 text-[12.5px] text-graphite">
            <span className="h-px flex-1 bg-line" /> sau <span className="h-px flex-1 bg-line" />
          </div>
          <button type="button" onClick={() => authClient.signIn.social({ provider: 'google', callbackURL: next })} className="btn btn-secondary w-full">
            Continuă cu Google
          </button>
        </>
      ) : null}
      <p className="mt-6 text-[12.5px] leading-relaxed text-graphite">Contul îți păstrează comenzile, rețetele și programările. Poți comanda și fără cont.</p>
    </div>
  )
}
