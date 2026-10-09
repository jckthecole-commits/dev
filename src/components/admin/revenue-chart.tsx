'use client'

import { useState } from 'react'
import { formatPrice } from '@/lib/format'

export type DayPoint = { day: string; revenue: number; orders: number }

/** Single-series column chart (cobalt). Thin columns, 4px rounded caps, hairline grid, hover tooltip, table view. */
export function RevenueChart({ data }: { data: DayPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 720
  const H = 220
  const padL = 56
  const padB = 26
  const padT = 14
  const max = Math.max(1, ...data.map((d) => d.revenue))
  const step = niceStep(max / 4)
  const top = Math.ceil(max / step) * step
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
  const plotW = W - padL - 8
  const plotH = H - padB - padT
  const band = plotW / data.length
  const barW = Math.min(16, band * 0.62)
  const y = (v: number) => padT + plotH - (v / top) * plotH
  const peak = data.reduce((best, d, i) => (d.revenue > (data[best]?.revenue ?? -1) ? i : best), 0)
  const fmtDay = (d: string) => new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`))
  const lei = (bani: number) => (bani >= 100000 ? `${(bani / 100000).toFixed(bani % 100000 === 0 ? 0 : 1).replace('.', ',')}k` : `${Math.round(bani / 100)}`)

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Venituri zilnice, ultimele ${data.length} zile. Maxim ${formatPrice(data[peak]?.revenue ?? 0)} pe ${data[peak] ? fmtDay(data[peak].day) : ''}.`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - 4} y1={y(t)} y2={y(t)} stroke="#E3E7E5" strokeWidth="1" />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#4A545B" fontFamily="var(--font-code)" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {lei(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = padL + i * band + (band - barW) / 2
          const h = Math.max(0, y(0) - y(d.revenue))
          const r = Math.min(4, h)
          return (
            <g key={d.day}>
              {h > 0 ? (
                <path
                  d={`M${x} ${y(0)}V${y(d.revenue) + r}Q${x} ${y(d.revenue)} ${x + r} ${y(d.revenue)}H${x + barW - r}Q${x + barW} ${y(d.revenue)} ${x + barW} ${y(d.revenue) + r}V${y(0)}Z`}
                  fill="#2638C9"
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              ) : null}
              <rect x={padL + i * band} y={padT} width={band} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} />
              {i % 5 === 0 || i === data.length - 1 ? (
                <text x={padL + i * band + band / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#4A545B" fontFamily="var(--font-code)">
                  {fmtDay(d.day)}
                </text>
              ) : null}
            </g>
          )
        })}
        {data[peak] && data[peak].revenue > 0 ? (
          <text x={padL + peak * band + band / 2} y={y(data[peak].revenue) - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0D1216">
            {lei(data[peak].revenue)}
          </text>
        ) : null}
        <line x1={padL} x2={W - 4} y1={y(0)} y2={y(0)} stroke="#D3D9D6" strokeWidth="1" />
      </svg>
      {hover !== null && data[hover] ? (
        <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl bg-ink px-3 py-2 text-[12.5px] text-fog shadow-lg" style={{ left: `${((padL + hover * band + band / 2) / W) * 100}%` }}>
          <div className="font-bold">{fmtDay(data[hover].day)}</div>
          <div className="tnum">{formatPrice(data[hover].revenue)}</div>
          <div className="text-fog/70">{data[hover].orders} comenzi</div>
        </div>
      ) : null}
      <details className="mt-2 text-[13px]">
        <summary className="text-graphite hover:text-ink">Vezi datele ca tabel</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-graphite"><th className="py-1 font-normal">Zi</th><th className="py-1 font-normal">Comenzi</th><th className="py-1 text-right font-normal">Venit</th></tr>
          </thead>
          <tbody className="tnum">
            {data.map((d) => (
              <tr key={d.day} className="border-t border-line-soft"><td className="py-1">{fmtDay(d.day)}</td><td className="py-1">{d.orders}</td><td className="py-1 text-right">{formatPrice(d.revenue)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}

function niceStep(raw: number) {
  const mag = 10 ** Math.floor(Math.log10(Math.max(raw, 1)))
  const n = raw / mag
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag
}
