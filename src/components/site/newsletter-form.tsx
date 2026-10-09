'use client'

import { useActionState } from 'react'
import { subscribe } from '@/app/actions/newsletter'

export function NewsletterForm({ source = 'footer' }: { source?: string }) {
  const [state, action, pending] = useActionState(subscribe, null)
  return (
    <form action={action} className="flex w-full flex-col gap-2">
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <label htmlFor={`nl-${source}`} className="sr-only">
          Adresa de e-mail
        </label>
        <input
          id={`nl-${source}`}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="adresa@email.ro"
          className="h-[52px] w-full rounded-full sm:w-auto sm:flex-1 border border-white/20 bg-white/[.06] px-5 text-fog outline-none placeholder:text-fog/40 focus:border-white/60"
        />
        <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        <input type="hidden" name="source" value={source} />
        <button type="submit" disabled={pending} className="btn bg-fog text-ink hover:bg-white">
          {pending ? 'Se trimite…' : 'Abonează-mă'}
        </button>
      </div>
      <p role="status" aria-live="polite" className={`min-h-5 text-[13px] ${state?.ok === false ? 'text-[#ffb4b4]' : 'text-fog/70'}`}>
        {state?.message ?? 'Prin abonare ești de acord cu politica de confidențialitate. Te poți dezabona oricând.'}
      </p>
    </form>
  )
}
