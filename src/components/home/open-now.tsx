'use client'

import { useEffect, useState } from 'react'
import type { DayHours } from '@/lib/settings-schema'
import { toMinutes, zonedParts } from '@/lib/time'

/** "Deschis acum" — computed in the browser against Bucharest time. */
export function OpenNow({ weekly }: { weekly: DayHours[] }) {
  const [label, setLabel] = useState<{ open: boolean; text: string } | null>(null)
  useEffect(() => {
    const update = () => {
      const p = zonedParts(new Date())
      const now = p.hour * 60 + p.minute
      const today = weekly.find((d) => d.day === p.weekday)
      if (today && !('closed' in today) && now >= toMinutes(today.open) && now < toMinutes(today.close)) {
        setLabel({ open: true, text: `Deschis acum · până la ${today.close}` })
        return
      }
      for (let i = 0; i < 7; i++) {
        const day = (p.weekday + i) % 7
        const d = weekly.find((x) => x.day === day)
        if (!d || 'closed' in d) continue
        if (i === 0 && now >= toMinutes(d.open)) continue
        const when = i === 0 ? 'azi' : i === 1 ? 'mâine' : ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'][day]
        setLabel({ open: false, text: `Închis acum · deschidem ${when} la ${d.open}` })
        return
      }
      setLabel({ open: false, text: 'Închis' })
    }
    update()
    const t = setInterval(update, 60_000)
    return () => clearInterval(t)
  }, [weekly])
  if (!label) return <span className="inline-block h-7 w-52 rounded-full skeleton" aria-hidden />
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-paper px-3 py-1.5 text-[13.5px] font-bold ring-1 ring-line-soft">
      <span className={`size-2 rounded-full ${label.open ? 'bg-ok shadow-[0_0_0_4px_rgba(29,107,76,.15)]' : 'bg-mist'}`} />
      {label.text}
    </span>
  )
}
