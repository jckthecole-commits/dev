'use client'

import { useState } from 'react'
import { placePartnerOrder } from '@/app/actions/b2b'
import { Icon } from '@/components/icons'
import { formatPrice } from '@/lib/format'
import { useActionForm } from '@/lib/use-action-form'

export function QuickOrder({ prices, minOrder, vat }: { prices: Record<string, number>; minOrder: number; vat: number }) {
  const [lines, setLines] = useState('')
  const [state, onSubmit, pending] = useActionForm(placePartnerOrder, null)
  const parsed = lines
    .split(/\r?\n/)
    .map((l) => l.trim().match(/^([A-Za-z0-9-]+)[\s;,x×*]+(\d{1,4})$/))
    .filter(Boolean)
    .map((m) => ({ sku: m![1]!.toUpperCase(), qty: Number(m![2]) }))
  const net = parsed.reduce((s, l) => s + (prices[l.sku] ?? 0) * l.qty, 0)
  const unknown = parsed.filter((l) => prices[l.sku] === undefined).map((l) => l.sku)

  if (state?.ok)
    return (
      <div className="rounded-2xl bg-ok-50 p-5 text-ok">
        <div className="flex items-center gap-2 font-bold"><Icon name="check" size={20} /> Comanda {state.number} a fost plasată.</div>
        <p className="mt-1 text-[14px]">Primești proforma pe e-mail. Vezi statusul mai jos, la „Comenzi”.</p>
      </div>
    )
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <textarea
        name="lines"
        value={lines}
        onChange={(e) => setLines(e.target.value)}
        rows={7}
        placeholder={'SV-MIRA-52-NGR 4\nSV-IRIS-49-AUR 2\nSVS-FALEZA-57-AUV;3'}
        className="field h-auto py-3 font-mono text-[14px]"
        aria-label="Coduri și cantități"
        spellCheck={false}
      />
      <input name="note" placeholder="Observații (opțional)" className="field" aria-label="Observații" />
      <div className="flex flex-wrap items-center justify-between gap-3 text-[14px]">
        <span className="text-graphite">
          {parsed.length} linii · net <strong className="text-ink tnum">{formatPrice(net)}</strong> · cu TVA <strong className="text-ink tnum">{formatPrice(Math.round(net * (1 + vat / 100)))}</strong>
          {net && net < minOrder ? <span className="text-warn"> · minim {formatPrice(minOrder)}</span> : null}
        </span>
        <button disabled={pending || !parsed.length} className="btn btn-primary btn-sm">{pending ? 'Se plasează…' : 'Plasează comanda'}</button>
      </div>
      {unknown.length ? <p className="text-[13px] text-warn">Coduri necunoscute: {unknown.join(', ')}</p> : null}
      {state && !state.ok ? <p role="alert" className="text-[14px] text-err">{state.error}</p> : null}
    </form>
  )
}
