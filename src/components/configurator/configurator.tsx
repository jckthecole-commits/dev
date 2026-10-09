'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState, useTransition } from 'react'
import { addToCart } from '@/app/actions/cart'
import { FrameArt, type FrameArtProduct } from '@/components/frame-art'
import { Icon } from '@/components/icons'
import { LensSection } from '@/components/shop/lens-section'
import { cn } from '@/lib/cn'
import type { LineConfiguration, Swatch } from '@/lib/db/schema'
import { formatDelta, formatFrameSize, formatPrice } from '@/lib/format'
import { dominantPower, estimateThickness, formatDiopter, recommendIndex, validateRx, type EyeRx, type IndexCode, type RxValues } from '@/lib/optics'
import { availableIndices, availableLensTypes, availableTreatments, lensTypeLabel, normalizeConfiguration, priceConfiguration, type LensCatalog, type VatRates } from '@/lib/pricing'
import { swatchCss } from '@/lib/product-art'

export type ConfigFrame = {
  slug: string
  name: string
  category: 'optical' | 'sun'
  price: number
  lensWidth: number
  bridgeWidth: number
  templeLength: number
  lensHeight: number
  rim: 'full' | 'semi' | 'rimless'
  vatClass: 'standard' | 'reduced' | 'exempt'
  art: FrameArtProduct
  variants: { id: string; colorName: string; colorSlug: string; swatch: Swatch; priceDelta: number }[]
}

type RxMode = 'manual' | 'upload' | 'later'

const range = (from: number, to: number, step: number) => {
  const out: number[] = []
  for (let v = from; v <= to + 1e-9; v += step) out.push(Math.round(v * 100) / 100)
  return out
}
const SPH = range(-12, 8, 0.25).reverse()
const CYL = range(-6, 6, 0.25).reverse()
const ADD = range(0.75, 3.5, 0.25)
const PD1 = range(50, 80, 0.5)
const PD2 = range(25, 40, 0.5)

/** Lens zone glyphs: where the optical power sits in each design. */
function LensGlyph({ code, active }: { code: string; active: boolean }) {
  const c = active ? '#2638C9' : '#8A939A'
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
      <defs>
        <linearGradient id={`lg-${code}-${active}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c} stopOpacity="0.05" />
          <stop offset="1" stopColor={c} stopOpacity="0.55" />
        </linearGradient>
        <clipPath id={`lc-${code}`}>
          <circle cx="13" cy="13" r="10.5" />
        </clipPath>
      </defs>
      <g clipPath={`url(#lc-${code})`}>
        {code === 'plano' ? <rect width="26" height="26" fill={c} opacity="0.12" /> : null}
        {code === 'single' ? <rect width="26" height="26" fill={c} opacity="0.35" /> : null}
        {code === 'office' ? <rect y="9" width="26" height="17" fill={`url(#lg-${code}-${active})`} /> : null}
        {code === 'progressive' ? <path d="M10 4h6l-1 9 3 13H8l3-13-1-9Z" fill={`url(#lg-${code}-${active})`} /> : null}
      </g>
      <circle cx="13" cy="13" r="10.5" fill="none" stroke={c} strokeWidth="1.4" strokeDasharray={code === 'none' ? '2.5 2' : undefined} />
    </svg>
  )
}

export function Configurator({ frame, catalog, vat, initialColor, productionDays }: { frame: ConfigFrame; catalog: LensCatalog; vat: VatRates; initialColor?: string; productionDays: string }) {
  const router = useRouter()
  const [vid, setVid] = useState(() => (frame.variants.find((v) => v.colorSlug === initialColor) ?? frame.variants[0]!).id)
  const v = frame.variants.find((x) => x.id === vid) ?? frame.variants[0]!
  const types = availableLensTypes(catalog, frame.category)
  const [lensType, setLensType] = useState<string>(frame.category === 'sun' ? 'none' : 'single')
  const type = catalog.types.find((t) => t.code === lensType)
  const needsRx = !!type?.requiresPrescription
  const [rxMode, setRxMode] = useState<RxMode>('manual')
  const [rx, setRx] = useState<RxValues>({ od: { sph: 0, cyl: 0, axis: null, add: null }, os: { sph: 0, cyl: 0, axis: null, add: null }, pd: { mode: 'single', value: 63 } })
  const [file, setFile] = useState<File | null>(null)
  const [touched, setTouched] = useState(false)
  const [indexCode, setIndexCode] = useState<string | undefined>(undefined)
  const [treatments, setTreatments] = useState<string[]>(() => catalog.treatments.filter((t) => t.isDefault).map((t) => t.code))
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const rxEntered = needsRx && rxMode === 'manual' && (rx.od.sph !== 0 || rx.os.sph !== 0 || rx.od.cyl !== 0 || rx.os.cyl !== 0)
  const recommended = recommendIndex(rxEntered ? rx : null, { rim: frame.rim, lensWidth: frame.lensWidth }, lensType) as string
  const indices = availableIndices(catalog, lensType)
  const effectiveIndex = indices.some((i) => i.code === indexCode) ? indexCode : indices.some((i) => i.code === recommended) ? recommended : indices[0]?.code
  const treatmentOptions = availableTreatments(catalog, frame.category, lensType)

  const config: LineConfiguration = { lensType, lensIndex: effectiveIndex, treatments, rxMode: needsRx ? rxMode : undefined, notes: notes || undefined }
  const frameForPricing = { name: frame.name, variantName: v.colorName, price: frame.price + v.priceDelta, category: frame.category, lensHeight: frame.lensHeight, rim: frame.rim, vatClass: frame.vatClass }
  const normalized = normalizeConfiguration(frameForPricing, config, catalog)
  const priced = priceConfiguration(frameForPricing, normalized, catalog, vat)

  const rxIssues = useMemo(() => (needsRx && rxMode === 'manual' ? validateRx(rx, { requiresAdd: type?.requiresAdd }) : []), [needsRx, rxMode, rx, type?.requiresAdd])
  const rxErrors = rxIssues.filter((i) => i.level === 'error')
  const power = rxEntered ? dominantPower(rx) : -2
  const pdNum = rx.pd.mode === 'single' ? rx.pd.value : rx.pd.mode === 'dual' ? rx.pd.left + rx.pd.right : 63

  const setEye = (eye: 'od' | 'os', patch: Partial<EyeRx>) => setRx((r) => ({ ...r, [eye]: { ...r[eye], ...patch } }))
  const toggleTreatment = (code: string) => {
    const t = treatmentOptions.find((x) => x.code === code)
    setTreatments((cur) => {
      if (cur.includes(code)) return cur.filter((c) => c !== code)
      const withoutGroup = t?.exclusiveGroup ? cur.filter((c) => catalog.treatments.find((x) => x.code === c)?.exclusiveGroup !== t.exclusiveGroup) : cur
      return [...withoutGroup, code]
    })
  }

  const submit = () => {
    setTouched(true)
    setError(null)
    if (needsRx && rxMode === 'manual' && rxErrors.length) {
      setError(rxErrors[0]!.message)
      document.getElementById('pas-reteta')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (needsRx && rxMode === 'upload' && !file) {
      setError('Alege o poză sau un PDF cu rețeta.')
      return
    }
    if (!priced.ok) {
      setError(priced.errors[0]!)
      return
    }
    start(async () => {
      const fd = new FormData()
      fd.set('variantId', v.id)
      fd.set('config', JSON.stringify(normalized))
      if (needsRx && rxMode === 'manual') fd.set('rx', JSON.stringify({ ...rx, notes: notes || undefined }))
      if (needsRx && rxMode === 'upload' && file) fd.set('rxFile', file)
      const r = await addToCart(fd)
      if (r.ok) router.push('/cos?adaugat=1')
      else setError(r.error)
    })
  }

  const visible = ['tip', needsRx && 'reteta', indices.length > 0 && 'indice', treatmentOptions.length > 0 && 'tratamente', lensType !== 'none' && 'note'].filter(Boolean) as string[]
  const num = (k: string) => visible.indexOf(k) + 1
  return (
    <div className="container-x grid gap-10 py-10 lg:grid-cols-[1fr_400px] lg:gap-14">
      <div className="flex flex-col gap-5">
        <div>
          <Link href={`/rame/${frame.slug}`} className="spec inline-flex items-center gap-1 no-underline hover:text-ink">
            <Icon name="arrow-left" size={14} /> Înapoi la {frame.name}
          </Link>
          <div className="eyebrow mt-6">Configurator · lentile pe dioptria ta</div>
          <h1 className="disp mt-3 text-[clamp(40px,5vw,68px)]">Configurează lentilele.</h1>
        </div>

        {/* 1. lens type */}
        <Step n={num('tip')} title="Tipul lentilei" id="pas-tip">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {types.map((t) => {
              const tooLow = !!t.minFittingHeight && frame.lensHeight < t.minFittingHeight
              const on = lensType === t.code
              return (
                <button
                  key={t.code}
                  type="button"
                  disabled={tooLow}
                  aria-pressed={on}
                  onClick={() => setLensType(t.code)}
                  className={cn('group relative flex flex-col items-start rounded-2xl p-4 text-left ring-1 transition-[box-shadow,background-color]', on ? 'bg-cobalt-50 ring-[1.5px] ring-cobalt' : 'bg-paper ring-line hover:ring-graphite', tooLow && 'opacity-50')}
                >
                  <span className="flex w-full items-center justify-between">
                    <span className="text-[16px] font-bold">{lensTypeLabel(t.code, frame.category, t.name)}</span>
                    <LensGlyph code={t.code} active={on} />
                  </span>
                  <span className="mt-1 text-[13.5px] leading-snug text-graphite">{tooLow ? `Rama are lentila de ${frame.lensHeight} mm; progresivele cer minimum ${t.minFittingHeight} mm.` : t.code === 'none' && frame.category === 'sun' ? 'Lentilele de soare incluse, fără corecție.' : t.summary}</span>
                  <span className="mt-3 text-[14px] font-bold tnum">{t.price ? `+${formatPrice(t.price)}` : 'inclus'}</span>
                </button>
              )
            })}
          </div>
        </Step>

        {/* 2. prescription */}
        {needsRx ? (
          <Step n={num('reteta')} title="Rețeta" id="pas-reteta" aside={<Link href="/ghid/prescriptie" target="_blank" className="text-[14px] font-bold text-cobalt">Cum citesc rețeta?</Link>}>
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Cum trimiți rețeta">
              {(
                [
                  ['manual', 'Completez acum', 'edit'],
                  ['upload', 'Încarc o poză', 'upload'],
                  ['later', 'Trimit mai târziu', 'clock'],
                ] as const
              ).map(([m, label, icon]) => (
                <button key={m} type="button" role="tab" aria-selected={rxMode === m} onClick={() => setRxMode(m)} className={cn('btn btn-sm', rxMode === m ? 'btn-ink' : 'btn-secondary')}>
                  <Icon name={icon} size={16} /> {label}
                </button>
              ))}
            </div>

            {rxMode === 'manual' ? (
              <div className="mt-5">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] border-separate border-spacing-y-2">
                    <thead>
                      <tr className="spec text-left">
                        <th className="w-32 font-normal" />
                        <th className="px-1 font-normal">SPH</th>
                        <th className="px-1 font-normal">CYL</th>
                        <th className="px-1 font-normal">AX (°)</th>
                        {type?.requiresAdd ? <th className="px-1 font-normal">ADD</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ['od', 'Ochi drept', 'OD'],
                          ['os', 'Ochi stâng', 'OS'],
                        ] as const
                      ).map(([eye, label, abbr]) => {
                        const e = rx[eye]
                        const err = (f: string) => touched && rxIssues.some((i) => i.field === `${eye}.${f}` && i.level === 'error')
                        return (
                          <tr key={eye}>
                            <th scope="row" className="pr-2 text-left text-[14.5px] font-bold">
                              {label} <span className="spec font-normal">({abbr})</span>
                            </th>
                            <td className="px-1">
                              <select aria-label={`SPH ${abbr}`} value={e.sph} onChange={(x) => setEye(eye, { sph: Number(x.target.value) })} aria-invalid={err('sph')} className="field h-12 tnum">
                                {SPH.map((n) => (
                                  <option key={n} value={n}>
                                    {formatDiopter(n)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-1">
                              <select aria-label={`CYL ${abbr}`} value={e.cyl} onChange={(x) => setEye(eye, { cyl: Number(x.target.value), axis: Number(x.target.value) === 0 ? null : e.axis })} aria-invalid={err('cyl')} className="field h-12 tnum">
                                {CYL.map((n) => (
                                  <option key={n} value={n}>
                                    {formatDiopter(n)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-1">
                              <input
                                aria-label={`Ax ${abbr}`}
                                inputMode="numeric"
                                disabled={e.cyl === 0}
                                placeholder={e.cyl === 0 ? '—' : '0–180'}
                                value={e.axis ?? ''}
                                onChange={(x) => {
                                  const raw = x.target.value.replace(/\D/g, '').slice(0, 3)
                                  setEye(eye, { axis: raw === '' ? null : Number(raw) })
                                }}
                                aria-invalid={err('axis')}
                                className="field h-12 text-center tnum disabled:opacity-50"
                              />
                            </td>
                            {type?.requiresAdd ? (
                              <td className="px-1">
                                <select aria-label={`ADD ${abbr}`} value={e.add ?? ''} onChange={(x) => setEye(eye, { add: x.target.value === '' ? null : Number(x.target.value) })} aria-invalid={err('add')} className="field h-12 tnum">
                                  <option value="">—</option>
                                  {ADD.map((n) => (
                                    <option key={n} value={n}>
                                      {formatDiopter(n)}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            ) : null}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 grid gap-4 rounded-2xl bg-glass p-4 ring-1 ring-line-soft sm:grid-cols-[1fr_auto] sm:items-end">
                  <div>
                    <div className="flex items-center gap-2 text-[14.5px] font-bold">
                      Distanța pupilară (PD)
                      <span className="spec font-normal">mm</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {rx.pd.mode === 'single' ? (
                        <select aria-label="PD" value={rx.pd.value} onChange={(x) => setRx((r) => ({ ...r, pd: { mode: 'single', value: Number(x.target.value) } }))} className="field h-11 w-28 tnum">
                          {PD1.map((n) => (
                            <option key={n} value={n}>
                              {n.toFixed(1).replace('.0', '').replace('.', ',')}
                            </option>
                          ))}
                        </select>
                      ) : rx.pd.mode === 'dual' ? (
                        <>
                          <select aria-label="PD ochi drept" value={rx.pd.right} onChange={(x) => setRx((r) => ({ ...r, pd: { ...(r.pd as { mode: 'dual'; right: number; left: number }), right: Number(x.target.value) } }))} className="field h-11 w-24 tnum">
                            {PD2.map((n) => (
                              <option key={n} value={n}>
                                OD {n.toString().replace('.', ',')}
                              </option>
                            ))}
                          </select>
                          <select aria-label="PD ochi stâng" value={rx.pd.left} onChange={(x) => setRx((r) => ({ ...r, pd: { ...(r.pd as { mode: 'dual'; right: number; left: number }), left: Number(x.target.value) } }))} className="field h-11 w-24 tnum">
                            {PD2.map((n) => (
                              <option key={n} value={n}>
                                OS {n.toString().replace('.', ',')}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : (
                        <span className="rounded-full bg-warn-50 px-3 py-2 text-[13.5px] text-warn">Te sunăm pentru PD înainte de montaj</span>
                      )}
                      <div className="flex gap-1 text-[13px]">
                        {(
                          [
                            ['single', 'Un număr'],
                            ['dual', 'Două valori'],
                            ['unknown', 'Nu știu'],
                          ] as const
                        ).map(([m, label]) => (
                          <button
                            key={m}
                            type="button"
                            aria-pressed={rx.pd.mode === m}
                            onClick={() => setRx((r) => ({ ...r, pd: m === 'single' ? { mode: 'single', value: 63 } : m === 'dual' ? { mode: 'dual', right: 31.5, left: 31.5 } : { mode: 'unknown' } }))}
                            className={cn('rounded-full px-3 py-1.5 ring-1', rx.pd.mode === m ? 'bg-ink text-fog ring-ink' : 'ring-line hover:ring-graphite')}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Link href={`/proba-virtuala?masoara=pd&rama=${frame.slug}`} target="_blank" className="inline-flex items-center gap-2 text-[14px] font-bold text-cobalt no-underline hover:underline">
                    <Icon name="ruler" size={18} /> Măsoară PD cu camera
                  </Link>
                </div>

                {rxIssues.length && (touched || rxEntered) ? (
                  <ul className="mt-4 flex flex-col gap-2" aria-live="polite">
                    {rxIssues
                      .filter((i) => touched || (i.level === 'warning' && rxEntered))
                      .map((i) => (
                        <li key={i.field + i.message} className={cn('flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-[14px]', i.level === 'error' ? 'bg-err-50 text-err' : 'bg-warn-50 text-warn')}>
                          <Icon name={i.level === 'error' ? 'alert' : 'info'} size={18} className="mt-0.5 shrink-0" /> {i.message}
                        </li>
                      ))}
                  </ul>
                ) : null}
              </div>
            ) : rxMode === 'upload' ? (
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const f = e.dataTransfer.files[0]
                    if (f) setFile(f)
                  }}
                  className="flex w-full flex-col items-center gap-2 rounded-2xl border-[1.5px] border-dashed border-line bg-paper px-6 py-10 text-center transition-colors hover:border-cobalt"
                >
                  <Icon name={file ? 'check' : 'upload'} size={28} className={file ? 'text-ok' : 'text-graphite'} />
                  <span className="text-[15.5px] font-bold">{file ? file.name : 'Fă o poză rețetei sau alege un fișier'}</span>
                  <span className="spec">{file ? `${(file.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB · apasă pentru altul` : 'JPG, PNG, HEIC sau PDF · max. 10 MB'}</span>
                </button>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Fișier rețetă" />
                <p className="mt-3 flex items-start gap-2 text-[13.5px] text-graphite">
                  <Icon name="lock" size={16} className="mt-0.5 shrink-0" /> Fișierul e criptat înainte de salvare și e văzut doar de optometrist.
                </p>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-glass p-5 text-[15px] leading-relaxed ring-1 ring-line-soft">
                După comandă îți trimitem pe e-mail un link de unde încarci rețeta (sau ne-o arăți în showroom). Lentilele intră în producție după ce optometristul o verifică.
              </div>
            )}
          </Step>
        ) : null}

        {/* 3. index */}
        {indices.length ? (
          <Step n={num('indice')} title="Grosimea lentilei" id="pas-indice" aside={<span className="spec">{rxEntered ? `estimare pentru ${formatDiopter(power)}` : 'estimare pentru −2,00'}</span>}>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {indices.map((ix) => {
                const on = effectiveIndex === ix.code
                const t = estimateThickness(power, ix.code as IndexCode, frame, pdNum)
                return (
                  <button key={ix.code} type="button" aria-pressed={on} onClick={() => setIndexCode(ix.code)} className={cn('relative flex flex-col rounded-2xl p-4 text-left ring-1 transition-[box-shadow,background-color]', on ? 'bg-cobalt-50 ring-[1.5px] ring-cobalt' : 'bg-paper ring-line hover:ring-graphite')}>
                    {ix.code === recommended ? <span className="absolute right-3 top-3 rounded-full bg-cobalt px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-white">Recomandat</span> : null}
                    <span className="font-mono text-[14px] font-medium">{ix.code}</span>
                    <span className="text-[14px] font-bold">{ix.name}</span>
                    <span className="mt-0.5 text-[12.5px] text-graphite">{ix.summary}</span>
                    <span className="my-3 block h-12">
                      <LensSection power={power} index={ix.code as IndexCode} frame={frame} pd={pdNum} highlight={on} className="h-full w-full" />
                    </span>
                    <span className="flex items-baseline justify-between">
                      <span className="tnum text-[14px]">≈ {t.max.toFixed(1).replace('.', ',')} mm</span>
                      <span className="text-[14px] font-bold tnum">{formatDelta(ix.price)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </Step>
        ) : null}

        {/* 4. treatments */}
        {treatmentOptions.length ? (
          <Step n={num('tratamente')} title="Tratamente" id="pas-tratamente">
            <div className="flex flex-col gap-2.5">
              {treatmentOptions.map((t) => {
                const on = treatments.includes(t.code)
                return (
                  <label key={t.code} className={cn('flex cursor-pointer items-center gap-4 rounded-2xl p-4 ring-1 transition-[box-shadow,background-color]', on ? 'bg-cobalt-50 ring-[1.5px] ring-cobalt' : 'bg-paper ring-line hover:ring-graphite')}>
                    <input type="checkbox" checked={on} onChange={() => toggleTreatment(t.code)} className="peer sr-only" />
                    <span aria-hidden className={cn('grid size-6 shrink-0 place-items-center rounded-[7px] ring-1 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cobalt', on ? 'bg-cobalt ring-cobalt' : 'bg-paper ring-line')}>
                      {on ? <Icon name="check" size={15} strokeWidth={2.4} className="text-white" /> : null}
                    </span>
                    <span className="flex-1">
                      <span className="block text-[15.5px] font-bold">{t.name}</span>
                      <span className="block text-[13.5px] text-graphite">
                        {t.summary}
                        {t.exclusiveGroup ? ' · se exclud reciproc' : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-[14.5px] font-bold tnum">{t.price ? `+${formatPrice(t.price)}` : 'inclus'}</span>
                  </label>
                )
              })}
            </div>
          </Step>
        ) : null}

        {lensType !== 'none' ? (
          <Step n={num('note')} title="Note pentru laborator (opțional)" id="pas-note">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 500))} rows={3} placeholder="De ex.: prisme, înălțime de montaj măsurată, preferințe…" className="field h-auto py-3" aria-label="Note pentru laborator" />
          </Step>
        ) : null}
      </div>

      {/* summary */}
      <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Rezumat">
        <div className="card bg-glass p-5">
          <div className="grid aspect-[16/9] place-items-center rounded-2xl bg-paper ring-1 ring-line-soft">
            <div className="w-[82%]">
              <FrameArt product={frame.art} swatch={v.swatch} shadow className="h-auto w-full" />
            </div>
          </div>
          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <div className="text-[17px] font-bold">{frame.name}</div>
              <div className="spec">
                {formatFrameSize(frame)} · {v.colorName.toLowerCase()}
              </div>
            </div>
            <div className="flex gap-1.5" role="radiogroup" aria-label="Culoare">
              {frame.variants.map((x) => (
                <button key={x.id} type="button" role="radio" aria-checked={x.id === v.id} aria-label={x.colorName} title={x.colorName} onClick={() => setVid(x.id)} className={cn('grid size-7 place-items-center rounded-full', x.id === v.id ? 'ring-[1.5px] ring-ink' : 'ring-1 ring-transparent hover:ring-line')}>
                  <span className="size-[18px] rounded-full ring-1 ring-black/10" style={{ background: swatchCss(x.swatch) }} />
                </button>
              ))}
            </div>
          </div>
          <dl className="mt-5 flex flex-col gap-2 border-t border-line pt-4 text-[14.5px]">
            {priced.lines.map((l) => (
              <div key={l.code} className="flex justify-between gap-4">
                <dt className="text-ink-2">{l.code === 'frame' ? 'Rama' : l.label}</dt>
                <dd className="shrink-0 tnum">{l.amount ? formatPrice(l.amount) : 'inclus'}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
            <span className="text-[17px] font-bold">Total</span>
            <span className="disp text-[32px] tnum">{formatPrice(priced.unitPrice)}</span>
          </div>
          <p className="spec mt-1 text-right">TVA inclus</p>
          {error ? (
            <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-err-50 px-3.5 py-2.5 text-[14px] text-err">
              <Icon name="alert" size={18} className="mt-0.5 shrink-0" /> {error}
            </p>
          ) : null}
          <button type="button" onClick={submit} disabled={pending} className="btn btn-primary btn-lg mt-5 w-full">
            {pending ? 'Se adaugă…' : 'Adaugă în coș'}
          </button>
          <p className="mt-4 text-[13px] leading-relaxed text-graphite">
            {lensType === 'none' ? 'Livrare în 1–2 zile lucrătoare.' : `Gata în ${productionDays} zile lucrătoare. Rețeta este verificată de un optometrist înainte de montaj.`}
          </p>
        </div>
      </aside>
    </div>
  )
}

function Step({ n, title, id, aside, children }: { n: number; title: string; id: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="card scroll-mt-24 bg-glass p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id={`${id}-t`} className="flex items-center gap-3 text-[18px] font-bold">
          <span className="grid size-7 place-items-center rounded-full bg-ink font-mono text-[12px] text-fog">{n}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}
