'use client'

import { sendContact } from '@/app/actions/contact'
import { Icon } from '@/components/icons'
import { useActionForm } from '@/lib/use-action-form'

export function ContactForm() {
  const [state, onSubmit, pending] = useActionForm(sendContact, null)
  const fe = state?.fieldErrors ?? {}
  if (state?.ok) return <p className="flex items-center gap-2 rounded-2xl bg-ok-50 p-5 text-ok"><Icon name="check" size={20} /> {state.message}</p>
  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`c-${name}`} className="mb-1.5 block text-[14px] font-bold">{label}</label>
      <input id={`c-${name}`} name={name} aria-invalid={!!fe[name]} className="field" {...props} />
      {fe[name] ? <p className="mt-1 text-[13px] text-err">{fe[name]}</p> : null}
    </div>
  )
  return (
    <form onSubmit={onSubmit} className="card grid gap-4 bg-glass p-6 sm:grid-cols-2 sm:p-8">
      <input type="text" name="hp" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />
      {field('name', 'Nume', { autoComplete: 'name' })}
      {field('email', 'E-mail', { type: 'email', autoComplete: 'email' })}
      {field('phone', 'Telefon (opțional)', { type: 'tel', autoComplete: 'tel' })}
      {field('orderNumber', 'Număr comandă (opțional)', { placeholder: 'SV-2026-…' })}
      <div className="sm:col-span-2">{field('subject', 'Subiect (opțional)')}</div>
      <div className="sm:col-span-2">
        <label htmlFor="c-message" className="mb-1.5 block text-[14px] font-bold">Mesaj</label>
        <textarea id="c-message" name="message" rows={5} aria-invalid={!!fe.message} className="field h-auto py-3" />
        {fe.message ? <p className="mt-1 text-[13px] text-err">{fe.message}</p> : null}
      </div>
      {state && !state.ok ? <p className="text-[14px] text-err sm:col-span-2">{state.message}</p> : null}
      <button disabled={pending} className="btn btn-primary sm:col-span-2 sm:justify-self-start">{pending ? 'Se trimite…' : 'Trimite mesajul'}</button>
    </form>
  )
}
