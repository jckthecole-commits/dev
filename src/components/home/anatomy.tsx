'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { FrameArt, type FrameArtProduct } from '@/components/frame-art'
import { Icon } from '@/components/icons'
import type { Swatch } from '@/lib/db/schema'
import type { FrameSpec } from '@/lib/frame-geometry'
import type { AnatomyEngine } from '@/components/three/anatomy-engine'

export type AnatomyData = {
  slug: string
  name: string
  colorName: string
  price: string
  art: FrameArtProduct
  swatch: Swatch
  templeLength: number
  frameWidth: number
  lensWidth: number
  lensHeight: number
  bridgeWidth: number
  weight: number | null
  /** Hinge knuckles when the product states them ("Balamale cu 5 butoiașe"). */
  knuckles: number | null
  flex: boolean
  /** Material line as the product states it, e.g. "Acetat Mazzucchelli". */
  material: string
  /** Edge thickness of a −4.00 lens in this frame, from the optics engine. */
  thickness: { power: string; low: { index: string; mm: string }; high: { index: string; mm: string } }
}

type Card = { part: string; value: string; title: string; text: string }

function cardsOf(d: AnatomyData): Card[] {
  return [
    {
      part: 'Frontul',
      value: `${d.frameWidth} mm`,
      title: d.material,
      text: 'Lățimea totală a frontului. Pune-o lângă rama pe care o porți acum — e cel mai sigur reper de mărime.',
    },
    {
      part: 'Lentilele',
      value: `${d.lensWidth} × ${d.lensHeight}`,
      title: 'Lentile tăiate pe rețeta ta',
      text: `La ${d.thickness.power} dioptrii, marginea iese de ${d.thickness.low.mm} mm pe indice ${d.thickness.low.index} și de ${d.thickness.high.mm} mm pe ${d.thickness.high.index} — calculat pe rama asta.`,
    },
    {
      part: 'Balamalele',
      value: d.knuckles ? `${d.knuckles} butoiașe` : d.flex ? 'Flex' : 'Șurub',
      title: d.flex ? 'Balamale flexibile, cu arc' : 'Balamale cu șurub',
      text: d.flex ? 'Brațul cedează puțin când deschizi rama, în loc să tragă de front.' : 'Se strâng din șurub, oricând începe să joace.',
    },
    {
      part: 'Brațele',
      value: `${d.templeLength} mm`,
      title: 'Cu curbură după ureche',
      text: 'Curbura o ajustăm gratuit în showroom, pe fața ta — și oricând mai târziu.',
    },
    {
      part: 'Puntea',
      value: `${d.bridgeWidth} mm`,
      title: 'Distanța dintre lentile',
      text: 'Decide cum stă rama pe nas mai mult decât lățimea totală.',
    },
  ]
}

function canRunGl() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return false
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

let glCapable: boolean | null = null
const glSnapshot = () => (glCapable ??= canRunGl())
const noSubscribe = () => () => {}

export function AnatomySection({ data }: { data: AnatomyData }) {
  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const leaderRef = useRef<SVGPathElement>(null)
  const dotRef = useRef<SVGGElement>(null)
  const dimLines = useRef<(SVGPathElement | null)[]>([])
  const dimTexts = useRef<(SVGTextElement | null)[]>([])
  const canGl = useSyncExternalStore(noSubscribe, glSnapshot, () => false)
  const [failed, setFailed] = useState(false)
  const mode = canGl && !failed ? 'gl' : 'static'
  const [ready, setReady] = useState(false)
  const cards = cardsOf(data)

  useEffect(() => {
    if (mode !== 'gl') return
    const section = sectionRef.current!
    let engine: AnatomyEngine | null = null
    let cancelled = false
    const io = new IntersectionObserver(
      async ([en]) => {
        if (!en?.isIntersecting) return
        io.disconnect()
        try {
          const { startAnatomyEngine } = await import('@/components/three/anatomy-engine')
          if (cancelled) return
          engine = await startAnatomyEngine({
            canvas: canvasRef.current!,
            section,
            stage: stageRef.current!,
            overlay: {
              svg: svgRef.current!,
              leader: leaderRef.current!,
              dot: dotRef.current!,
              dims: [0, 1].map((i) => ({ line: dimLines.current[i]!, text: dimTexts.current[i]! })),
            },
            spec: data.art as FrameSpec,
            swatch: data.swatch,
            templeLength: data.templeLength,
            knuckles: data.knuckles ?? 1,
            labels: {
              frameWidth: `${data.frameWidth} mm`,
              lensWidth: `${data.lensWidth} mm`,
              lensHeight: `${data.lensHeight} mm`,
              temple: `${data.templeLength} mm`,
              bridge: `${data.bridgeWidth} mm`,
            },
            onReady: () => setReady(true),
          })
          if (cancelled) engine.dispose()
        } catch {
          // no WebGL after all — the static version stays
          setFailed(true)
        }
      },
      { rootMargin: '900px 0px' },
    )
    io.observe(section)
    return () => {
      cancelled = true
      io.disconnect()
      engine?.dispose()
    }
  }, [mode, data])

  // keyboard users tabbing into the final links: jump to the end of the scroll track
  const revealFinal = () => {
    if (mode !== 'gl' || stageRef.current?.dataset.step === '5') return
    const s = sectionRef.current!
    const top = s.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: top + s.offsetHeight - window.innerHeight, behavior: 'instant' })
  }

  return (
    <section ref={sectionRef} aria-labelledby="anatomie" className="anat" data-mode={mode} data-ready={ready ? '' : undefined}>
      <div ref={stageRef} className="anat-stage">
        <canvas ref={canvasRef} className="anat-canvas" aria-hidden />
        <div className="anat-art" aria-hidden>
          <FrameArt product={data.art} swatch={data.swatch} className="h-auto w-full" />
        </div>
        <svg ref={svgRef} className="anat-overlay" aria-hidden>
          <g className="anat-dims">
            {[0, 1].map((i) => (
              <g key={i}>
                <path ref={(el) => void (dimLines.current[i] = el)} />
                <text ref={(el) => void (dimTexts.current[i] = el)} />
              </g>
            ))}
          </g>
          <path ref={leaderRef} className="anat-leader" />
          <g ref={dotRef}>
            <circle r="11" className="anat-ring" />
            <circle r="3.5" className="anat-dot" />
          </g>
        </svg>

        <header className="anat-intro">
          <div className="eyebrow">Anatomia ramei · {data.name}</div>
          <h2 id="anatomie" className="disp mt-4 text-[clamp(40px,6.4vw,92px)]">
            Ce porți, <em>piesă cu piesă.</em>
          </h2>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed text-white/70">
            {data.name}, desfăcută în bucăți. Fiecare cotă de aici e cea din fișa ramei.
          </p>
        </header>

        <ol className="anat-index" aria-hidden>
          {cards.map((c, i) => (
            <li key={c.part}>
              <span>{String(i + 1).padStart(2, '0')}</span> {c.part}
            </li>
          ))}
        </ol>

        <ol className="anat-cards">
          {cards.map((c, i) => (
            <li key={c.part} data-anat-card={i}>
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">
                {String(i + 1).padStart(2, '0')} / {String(cards.length).padStart(2, '0')} · {c.part}
              </div>
              <div className="anat-value">{c.value}</div>
              <h3 className="text-[18px] font-bold leading-snug">{c.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-white/70">{c.text}</p>
            </li>
          ))}
        </ol>

        <div className="anat-final">
          {data.weight ? (
            <div className="anat-weight">
              {data.weight}
              <span> g</span>
            </div>
          ) : null}
          <p className="text-[17px] text-white/75">
            Tot ce ai văzut, pe cântar. {data.name} în {data.colorName.toLowerCase()}, {data.price}.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href={`/rame/${data.slug}`} onFocus={revealFinal} className="btn btn-primary">
              Vezi {data.name}
              <Icon name="arrow-right" size={18} />
            </Link>
            <Link href="/rame-de-vedere/acetat" onFocus={revealFinal} className="btn anat-btn-ghost">
              Toate ramele din acetat
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
