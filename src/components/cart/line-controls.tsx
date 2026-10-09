'use client'

import { useTransition } from 'react'
import { removeLine, updateQuantity } from '@/app/actions/cart'
import { Icon } from '@/components/icons'

export function LineControls({ lineId, quantity, adjustable }: { lineId: string; quantity: number; adjustable: boolean }) {
  const [pending, start] = useTransition()
  return (
    <div className={`flex items-center gap-3 ${pending ? 'opacity-50' : ''}`}>
      {adjustable ? (
        <div className="flex items-center rounded-full ring-1 ring-line">
          <button type="button" aria-label="Scade cantitatea" disabled={pending} onClick={() => start(async () => void (await updateQuantity(lineId, quantity - 1)))} className="grid size-9 place-items-center rounded-full hover:bg-fog">
            <Icon name="minus" size={16} />
          </button>
          <span className="w-6 text-center text-[14px] font-bold tnum" aria-live="polite">
            {quantity}
          </span>
          <button type="button" aria-label="Crește cantitatea" disabled={pending} onClick={() => start(async () => void (await updateQuantity(lineId, quantity + 1)))} className="grid size-9 place-items-center rounded-full hover:bg-fog">
            <Icon name="plus" size={16} />
          </button>
        </div>
      ) : null}
      <button type="button" disabled={pending} onClick={() => start(async () => void (await removeLine(lineId)))} className="inline-flex items-center gap-1.5 text-[13.5px] text-graphite hover:text-err">
        <Icon name="trash" size={16} /> Șterge
      </button>
    </div>
  )
}
