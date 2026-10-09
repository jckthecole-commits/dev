'use client'

import { useActionForm } from '@/lib/use-action-form'
import { updateProfile } from '@/app/actions/account'

export function ProfileForm({ name, phone, marketing }: { name: string; phone: string; marketing: boolean }) {
  const [state, onSubmit, pending] = useActionForm(updateProfile, null)
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-[14px] font-bold">
        Nume
        <input name="name" defaultValue={name} required className="field font-normal" />
      </label>
      <label className="flex flex-col gap-1.5 text-[14px] font-bold">
        Telefon
        <input name="phone" defaultValue={phone} type="tel" className="field font-normal" />
      </label>
      <label className="flex items-center gap-3 text-[14px]">
        <input type="checkbox" name="marketing" defaultChecked={marketing} className="size-4 accent-cobalt" /> Vreau noutăți pe e-mail
      </label>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn btn-ink btn-sm">{pending ? 'Se salvează…' : 'Salvează'}</button>
        {state ? <span className={`text-[13px] ${state.ok ? 'text-ok' : 'text-err'}`}>{state.message}</span> : null}
      </div>
    </form>
  )
}
