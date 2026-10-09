'use client'

import { useState, useTransition } from 'react'
import { applyCoupon } from '@/app/actions/cart'

export function CouponForm({ current }: { current: string | null }) {
  const [code, setCode] = useState(current ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const r = await applyCoupon(code)
          setMsg(r.ok ? { ok: true, text: r.message ?? (code ? 'Cod aplicat.' : 'Cod eliminat.') } : { ok: false, text: r.error })
        })
      }}
      className="flex flex-col gap-1.5"
    >
      <div className="flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Cod de reducere" aria-label="Cod de reducere" className="field h-11 flex-1 font-mono uppercase" />
        <button type="submit" disabled={pending} className="btn btn-secondary btn-sm h-11">
          {current && code === current ? 'Aplicat' : 'Aplică'}
        </button>
      </div>
      {msg ? <p className={`text-[13px] ${msg.ok ? 'text-ok' : 'text-err'}`}>{msg.text}</p> : null}
    </form>
  )
}
