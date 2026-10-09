'use client'

import Link from 'next/link'
import { useId, useState } from 'react'
import { LensSection } from '@/components/shop/lens-section'
import { cn } from '@/lib/cn'
import { formatDelta } from '@/lib/format'
import { estimateThickness, formatDiopter, recommendIndex, type IndexCode } from '@/lib/optics'

type Idx = { code: string; name: string; price: number }

export function ThicknessLab({ indices }: { indices: Idx[] }) {
  const [power, setPower] = useState(-4)
  const id = useId()
  const frame = { lensWidth: 52, bridgeWidth: 18 }
  const rec = recommendIndex({ od: { sph: power, cyl: 0, axis: null, add: null }, os: { sph: power, cyl: 0, axis: null, add: null } }, { rim: 'full', lensWidth: 52 })
  return (
    <div className="card overflow-hidden bg-glass">
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[320px_1fr] lg:gap-12">
        <div className="flex flex-col">
          <div className="eyebrow">Laborator · grosimea lentilei</div>
          <label htmlFor={id} className="mt-5 block text-[15px] text-ink-2">
            Dioptria ta (SPH)
          </label>
          <output htmlFor={id} className="disp mt-1 block text-[64px] tnum leading-none">
            {formatDiopter(power)}
          </output>
          <input
            id={id}
            type="range"
            min={-8}
            max={6}
            step={0.25}
            value={power}
            onChange={(e) => setPower(Number(e.target.value))}
            className="mt-6 w-full accent-cobalt"
            aria-valuetext={`${formatDiopter(power)} dioptrii`}
          />
          <div className="spec mt-1.5 flex justify-between">
            <span>−8,00 miopie</span>
            <span>+6,00 hipermetropie</span>
          </div>
          <p className="mt-6 text-[14.5px] leading-relaxed text-graphite">
            Calcul pe rama <strong className="text-ink">Mira 52□18</strong>, PD 63 mm. Configuratorul face același calcul cu rama și rețeta ta.
          </p>
          <Link href="/rame-de-vedere" className="btn btn-ink mt-auto hidden self-start lg:inline-flex">
            Alege rama
          </Link>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {indices.map((ix) => {
            const code = ix.code as IndexCode
            const t = estimateThickness(power, code, frame)
            const isRec = code === rec
            return (
              <li key={ix.code} className={cn('relative flex flex-col rounded-2xl p-4 transition-colors', isRec ? 'bg-cobalt-50 ring-1 ring-cobalt/30' : 'bg-paper ring-1 ring-line-soft')}>
                {isRec ? <span className="absolute right-3 top-3 rounded-full bg-cobalt px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-white">Recomandat</span> : null}
                <div className="font-mono text-[13px] font-medium">{ix.code}</div>
                <div className="text-[13px] text-graphite">{ix.name}</div>
                <div className="my-4 flex h-24 items-end">
                  <LensSection power={power} index={code} frame={frame} highlight={isRec} className="h-full w-full" />
                </div>
                <div className="disp text-[30px] tnum leading-none">
                  {t.max.toFixed(1).replace('.', ',')}
                  <span className="ml-1 font-sans text-[13px] font-normal tracking-normal text-graphite">mm</span>
                </div>
                <div className="spec mt-1">{t.kind === 'plus' ? 'la centru' : t.kind === 'minus' ? 'la margine' : 'grosime'}</div>
                <div className="mt-3 border-t border-line pt-3 text-[13.5px] font-bold tnum">{formatDelta(ix.price)}</div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
