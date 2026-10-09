'use client'

import { useActionForm } from '@/lib/use-action-form'
import { applyPartner } from '@/app/actions/b2b'
import { Icon } from '@/components/icons'
import { COUNTIES } from '@/lib/ro'

export function ApplyForm() {
  const [state, onSubmit, pending] = useActionForm(applyPartner, null)
  const fe = state && !state.ok ? (state.fieldErrors ?? {}) : {}
  if (state?.ok)
    return (
      <div className="card flex flex-col items-center bg-glass p-10 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-ok text-white"><Icon name="check" size={28} /></span>
        <h3 className="disp mt-5 text-[32px]">Cerere trimisă.</h3>
        <p className="mt-2 max-w-sm text-ink-2">Revenim în 1–2 zile lucrătoare cu oferta și accesul în portal.</p>
      </div>
    )
  return (
    <form onSubmit={onSubmit} className="card grid gap-4 bg-glass p-6 sm:grid-cols-6 sm:p-8">
      <input type="text" name="hp" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />
      <F fe={fe} className="sm:col-span-4" name="companyName" label="Denumire firmă" autoComplete="organization" />
      <F fe={fe} className="sm:col-span-2" name="cui" label="CUI" placeholder="RO12345678" />
      <F fe={fe} className="sm:col-span-3" name="regCom" label="Nr. Reg. Com." placeholder="J17/123/2020" />
      <F fe={fe} className="sm:col-span-3" name="storesCount" label="Număr de magazine" type="number" min={1} defaultValue={1} />
      <F fe={fe} className="sm:col-span-6" name="address" label="Adresa sediului / magazinului" />
      <F fe={fe} className="sm:col-span-3" name="city" label="Localitate" />
      <div className="sm:col-span-3">
        <label htmlFor="p-county" className="mb-1.5 block text-[14px] font-bold">Județ</label>
        <select id="p-county" name="county" defaultValue="" className="field" aria-invalid={!!fe.county}>
          <option value="" disabled>Alege…</option>
          {COUNTIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        {fe.county ? <p className="mt-1 text-[13px] text-err">{fe.county}</p> : null}
      </div>
      <F fe={fe} className="sm:col-span-2" name="contactName" label="Persoană de contact" autoComplete="name" />
      <F fe={fe} className="sm:col-span-2" name="email" label="E-mail" type="email" autoComplete="email" />
      <F fe={fe} className="sm:col-span-2" name="phone" label="Telefon" type="tel" autoComplete="tel" />
      <F fe={fe} className="sm:col-span-6" name="website" label="Site / pagină de Facebook (opțional)" />
      <div className="sm:col-span-6">
        <label htmlFor="p-message" className="mb-1.5 block text-[14px] font-bold">Ce te interesează? (opțional)</label>
        <textarea id="p-message" name="message" rows={3} className="field h-auto py-3" placeholder="Volume estimate, modele de interes, consignație…" />
      </div>
      <label className="flex items-start gap-3 text-[13.5px] sm:col-span-6">
        <input type="checkbox" name="consent" className="mt-0.5 size-4 accent-cobalt" />
        <span>Sunt de acord cu prelucrarea datelor pentru evaluarea cererii de parteneriat.</span>
      </label>
      {fe.consent ? <p className="text-[13px] text-err sm:col-span-6">{fe.consent}</p> : null}
      {state && !state.ok ? <p role="alert" className="text-[14px] text-err sm:col-span-6">{state.error}</p> : null}
      <button disabled={pending} className="btn btn-primary sm:col-span-6 sm:justify-self-start">{pending ? 'Se trimite…' : 'Trimite cererea'}</button>
    </form>
  )
}

function F({ name, label, className, fe, ...rest }: { name: string; label: string; className?: string; fe: Record<string, string> } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <label htmlFor={`p-${name}`} className="mb-1.5 block text-[14px] font-bold">{label}</label>
      <input id={`p-${name}`} name={name} aria-invalid={!!fe[name]} className="field" {...rest} />
      {fe[name] ? <p className="mt-1 text-[13px] text-err">{fe[name]}</p> : null}
    </div>
  )
}
