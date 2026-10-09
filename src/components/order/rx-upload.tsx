'use client'

import { useActionState } from 'react'
import { uploadOrderRx } from '@/app/actions/order'
import { Icon } from '@/components/icons'

export function OrderRxUpload({ number, token, itemId, productName }: { number: string; token: string; itemId: string; productName: string }) {
  const [state, action, pending] = useActionState(uploadOrderRx, null)
  if (state?.ok)
    return (
      <p className="flex items-center gap-2 rounded-xl bg-ok-50 p-3 text-[14px] text-ok">
        <Icon name="check" size={18} /> {state.message}
      </p>
    )
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <input type="hidden" name="number" value={number} />
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="itemId" value={itemId} />
      <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-xl bg-paper px-4 py-3 ring-1 ring-line hover:ring-cobalt">
        <Icon name="upload" size={20} />
        <span className="text-[14px]">Rețeta pentru {productName}</span>
        <input type="file" name="file" accept="image/*,application/pdf" capture="environment" required className="ml-auto max-w-[200px] text-[12.5px] file:mr-2 file:rounded-full file:border-0 file:bg-fog file:px-3 file:py-1.5" />
      </label>
      <button type="submit" disabled={pending} className="btn btn-ink btn-sm">
        {pending ? 'Se încarcă…' : 'Trimite rețeta'}
      </button>
      {state && !state.ok ? <p className="text-[13px] text-err">{state.message}</p> : null}
    </form>
  )
}
