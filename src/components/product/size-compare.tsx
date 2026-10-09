'use client'

import { useState } from 'react'
import { Icon } from '@/components/icons'
import type { FrameSpec } from '@/lib/frame-geometry'
import { FrameDiagram } from './frame-diagram'

/** Overlay the customer's current frame (from the numbers on its temple) on this one. */
export function SizeCompare({ spec, temple, frameWidth }: { spec: FrameSpec; temple: number; frameWidth: number }) {
  const [a, setA] = useState('')
  const [d, setD] = useState('')
  const [t, setT] = useState('')
  const A = Number(a)
  const D = Number(d)
  const T = Number(t)
  const valid = A >= 38 && A <= 66 && D >= 12 && D <= 26
  const overlay: FrameSpec | null = valid ? { ...spec, lensWidth: A, bridgeWidth: D } : null
  const diff = (x: number, y: number) => {
    const v = x - y
    return v === 0 ? 'identic' : `${v > 0 ? '+' : '−'}${Math.abs(v)} mm`
  }
  return (
    <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:items-center">
      <div className="card overflow-hidden p-4 sm:p-6">
        <FrameDiagram spec={spec} temple={temple} frameWidth={frameWidth} overlay={overlay} className="h-auto w-full" />
      </div>
      <div>
        <div className="eyebrow">Fișă tehnică</div>
        <h2 className="disp mt-3 text-[clamp(30px,3.6vw,46px)]">Compară cu rama pe care o porți.</h2>
        <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">Uită-te pe interiorul brațului ramei tale: găsești trei numere. Le desenăm peste aceasta, la aceeași scară, cu linie punctată.</p>
        <div className="mt-6 flex items-center gap-2 font-mono">
          <input value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" placeholder="52" aria-label="Lățimea lentilei ramei tale (mm)" className="field h-12 w-20 text-center text-[17px]" />
          <span className="text-[20px]" aria-hidden>
            □
          </span>
          <input value={d} onChange={(e) => setD(e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" placeholder="18" aria-label="Puntea ramei tale (mm)" className="field h-12 w-20 text-center text-[17px]" />
          <input value={t} onChange={(e) => setT(e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" placeholder="145" aria-label="Lungimea brațului ramei tale (mm)" className="field h-12 w-24 text-center text-[17px]" />
        </div>
        {valid ? (
          <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
            {[
              ['Lentilă', diff(spec.lensWidth, A)],
              ['Punte', diff(spec.bridgeWidth, D)],
              ['Braț', T ? diff(temple, T) : '—'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-paper p-3 ring-1 ring-line-soft">
                <dt className="spec">{k}</dt>
                <dd className="mt-1 font-bold tnum">{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-5 flex items-center gap-2 text-[13.5px] text-graphite">
            <Icon name="info" size={16} /> ±2 mm la lentilă abia se simte; 4 mm se vede.
          </p>
        )}
      </div>
    </div>
  )
}
