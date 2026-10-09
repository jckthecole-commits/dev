'use client'

import { useRouter } from 'next/navigation'
import { createContext, use, useRef, useState, useTransition } from 'react'
import { Icon } from '@/components/icons'
import { shapeIconSrc } from '@/lib/frame-images'
import { cn } from '@/lib/cn'
import { activeFilterCount, AUDIENCES, COLOR_FAMILIES, FEATURES, filtersToQuery, FITS, MATERIALS, RIMS, SHAPES, SORTS, type CatalogFilters } from '@/lib/catalog-filters'
import type { Facets } from '@/lib/catalog-query'

const PendingCtx = createContext<{ pending: boolean; go: (f: CatalogFilters) => void } | null>(null)

/** Shares navigation state between the filter panel and the results grid (dims while loading). */
export function CatalogNav({ basePath, children }: { basePath: string; children: React.ReactNode }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const go = (f: CatalogFilters) => start(() => router.push(`${basePath}${filtersToQuery({ ...f, page: 1 })}`, { scroll: false }))
  return <PendingCtx value={{ pending, go }}>{children}</PendingCtx>
}

function useNav() {
  const ctx = use(PendingCtx)
  if (!ctx) throw new Error('CatalogNav missing')
  return ctx
}

export function ResultsShell({ children }: { children: React.ReactNode }) {
  const { pending } = useNav()
  return (
    <div aria-busy={pending} className={cn('transition-[opacity,filter] duration-300', pending && 'pointer-events-none opacity-50 blur-[2px]')}>
      {children}
    </div>
  )
}

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
const count = (facet: { value: string; count: number }[], v: string) => facet.find((f) => f.value === v)?.count ?? 0

function Group({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group border-b border-line py-4">
      <summary className="flex items-center justify-between text-[15px] font-bold">
        {title}
        <Icon name="chevron-down" size={18} className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  )
}

function Check({ checked, onChange, label, n, disabled, children }: { checked: boolean; onChange: () => void; label: string; n: number; disabled?: boolean; children?: React.ReactNode }) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-3 rounded-lg py-1.5 text-[15px]', disabled && !checked && 'opacity-40')}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled && !checked} className="peer sr-only" />
      <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-[6px] bg-paper ring-1 ring-line transition-colors peer-checked:bg-ink peer-checked:ring-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cobalt">
        {checked ? <Icon name="check" size={14} strokeWidth={2.2} className="text-white" /> : null}
      </span>
      {children}
      <span className="flex-1">{label}</span>
      <span className="spec">{n}</span>
    </label>
  )
}

function RangeInputs({ label, unit, min, max, onApply }: { label: string; unit: string; min: number | null; max: number | null; onApply: (min: number | null, max: number | null) => void }) {
  const [a, setA] = useState(min?.toString() ?? '')
  const [b, setB] = useState(max?.toString() ?? '')
  const apply = () => {
    const na = a.trim() === '' ? null : Number(a)
    const nb = b.trim() === '' ? null : Number(b)
    if ((na === null || Number.isFinite(na)) && (nb === null || Number.isFinite(nb)) && (na !== min || nb !== max)) onApply(na, nb)
  }
  return (
    <fieldset className="flex items-center gap-2">
      <legend className="sr-only">{label}</legend>
      <input inputMode="numeric" value={a} onChange={(e) => setA(e.target.value)} onBlur={apply} onKeyDown={(e) => e.key === 'Enter' && apply()} placeholder="min" aria-label={`${label} minim`} className="field h-10 w-full text-center tnum" />
      <span className="text-mist">—</span>
      <input inputMode="numeric" value={b} onChange={(e) => setB(e.target.value)} onBlur={apply} onKeyDown={(e) => e.key === 'Enter' && apply()} placeholder="max" aria-label={`${label} maxim`} className="field h-10 w-full text-center tnum" />
      <span className="spec w-6 shrink-0">{unit}</span>
    </fieldset>
  )
}

/** "Compară cu rama ta": enter the three numbers printed on your current temple. */
function MySize({ filters, go }: { filters: CatalogFilters; go: (f: CatalogFilters) => void }) {
  const [a, setA] = useState('')
  const [d, setD] = useState('')
  const [t, setT] = useState('')
  const apply = (e: React.FormEvent) => {
    e.preventDefault()
    const A = Number(a)
    const D = Number(d)
    const T = Number(t)
    go({
      ...filters,
      lensMin: A ? A - 2 : null,
      lensMax: A ? A + 2 : null,
      bridgeMin: D ? D - 2 : null,
      bridgeMax: D ? D + 2 : null,
      templeMin: T ? T - 5 : null,
      templeMax: T ? T + 5 : null,
    })
  }
  return (
    <form onSubmit={apply} className="rounded-2xl bg-paper p-4 ring-1 ring-line-soft">
      <div className="flex items-center gap-2 text-[14px] font-bold">
        <Icon name="ruler" size={18} /> Compară cu rama ta
      </div>
      <p className="mt-1 text-[13px] leading-snug text-graphite">Numerele de pe interiorul brațului, de ex. 52□18 145.</p>
      <div className="mt-3 flex items-center gap-1.5 font-mono">
        <input value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" placeholder="52" aria-label="Lățime lentilă (mm)" className="field h-10 w-full px-2 text-center" />
        <span aria-hidden>□</span>
        <input value={d} onChange={(e) => setD(e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" placeholder="18" aria-label="Punte (mm)" className="field h-10 w-full px-2 text-center" />
        <input value={t} onChange={(e) => setT(e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" placeholder="145" aria-label="Lungime braț (mm)" className="field h-10 w-full px-2 text-center" />
      </div>
      <button type="submit" className="btn btn-ink btn-sm mt-3 w-full">
        Arată rame similare
      </button>
    </form>
  )
}

function Panel({ filters, facets, category }: { filters: CatalogFilters; facets: Facets; category: 'optical' | 'sun' }) {
  const { go } = useNav()
  const set = (patch: Partial<CatalogFilters>) => go({ ...filters, ...patch })
  return (
    <div>
      <MySize filters={filters} go={go} />
      <Group title="Formă">
        <div className="flex flex-col">
          {SHAPES.filter((s) => count(facets.shape, s.value) > 0 || filters.shape.includes(s.value)).map((s) => (
            <Check key={s.value} checked={filters.shape.includes(s.value)} onChange={() => set({ shape: toggle(filters.shape, s.value) })} label={s.plural} n={count(facets.shape, s.value)}>
              <img src={shapeIconSrc(s.value, '4A545B')} alt="" width={40} height={16} decoding="async" className="h-4 w-10 shrink-0 object-contain" />
            </Check>
          ))}
        </div>
      </Group>
      <Group title="Lățimea ramei">
        <div className="grid grid-cols-3 gap-2">
          {FITS.map((f) => {
            const on = filters.fit.includes(f.value)
            return (
              <button key={f.value} type="button" aria-pressed={on} onClick={() => set({ fit: toggle(filters.fit, f.value) })} className={cn('flex flex-col items-center rounded-xl px-2 py-2.5 text-center ring-1 transition-colors', on ? 'bg-ink text-fog ring-ink' : 'bg-paper ring-line hover:ring-graphite')}>
                <span className="text-[14px] font-bold">{f.label}</span>
                <span className={cn('font-mono text-[10.5px]', on ? 'text-fog/70' : 'text-graphite')}>{f.hint}</span>
              </button>
            )
          })}
        </div>
      </Group>
      <Group title="Culoare">
        <div className="grid grid-cols-6 gap-2">
          {COLOR_FAMILIES.filter((c) => count(facets.color, c.value) > 0 || filters.color.includes(c.value)).map((c) => {
            const on = filters.color.includes(c.value)
            return (
              <button key={c.value} type="button" aria-pressed={on} aria-label={`${c.label} (${count(facets.color, c.value)})`} title={c.label} onClick={() => set({ color: toggle(filters.color, c.value) })} className={cn('grid aspect-square place-items-center rounded-full transition-shadow', on ? 'ring-2 ring-ink ring-offset-2 ring-offset-glass' : 'ring-1 ring-line hover:ring-graphite')}>
                <span className="size-[70%] rounded-full ring-1 ring-black/10" style={{ background: c.value === 'transparent' ? 'linear-gradient(135deg,#ffffff,#DDE4E8)' : c.value === 'havana' ? 'radial-gradient(circle at 30% 35%,#C08A45 0 20%,transparent 21%),#5A3519' : c.hex }} />
              </button>
            )
          })}
        </div>
      </Group>
      <Group title="Material">
        {MATERIALS.filter((m) => count(facets.material, m.value) > 0 || filters.material.includes(m.value)).map((m) => (
          <Check key={m.value} checked={filters.material.includes(m.value)} onChange={() => set({ material: toggle(filters.material, m.value) })} label={m.label} n={count(facets.material, m.value)} />
        ))}
      </Group>
      <Group title="Pentru">
        {AUDIENCES.filter((a) => count(facets.audience, a.value) > 0 || filters.audience.includes(a.value)).map((a) => (
          <Check key={a.value} checked={filters.audience.includes(a.value)} onChange={() => set({ audience: toggle(filters.audience, a.value) })} label={a.label} n={count(facets.audience, a.value)} />
        ))}
      </Group>
      <Group title="Caracteristici">
        {FEATURES.filter((f) => count(facets.feature, f.value) > 0 || filters.feature.includes(f.value)).map((f) => (
          <Check key={f.value} checked={filters.feature.includes(f.value)} onChange={() => set({ feature: toggle(filters.feature, f.value) })} label={f.label} n={count(facets.feature, f.value)} />
        ))}
      </Group>
      {category === 'optical' ? (
        <Group title="Tip ramă" defaultOpen={false}>
          {RIMS.map((r) => (
            <Check key={r.value} checked={filters.rim.includes(r.value)} onChange={() => set({ rim: toggle(filters.rim, r.value) })} label={r.label} n={count(facets.rim, r.value)} disabled={count(facets.rim, r.value) === 0} />
          ))}
        </Group>
      ) : null}
      <Group title="Preț ramă" defaultOpen={false}>
        <RangeInputs key={`${filters.priceMin}-${filters.priceMax}`} label="Preț" unit="lei" min={filters.priceMin} max={filters.priceMax} onApply={(a, b) => set({ priceMin: a, priceMax: b })} />
      </Group>
      <Group title="Dimensiuni exacte (mm)" defaultOpen={filters.lensMin !== null || filters.bridgeMin !== null || filters.templeMin !== null}>
        <div className="flex flex-col gap-3">
          <div>
            <div className="spec mb-1.5">Lățime lentilă (A)</div>
            <RangeInputs key={`${filters.lensMin}-${filters.lensMax}`} label="Lățime lentilă" unit="mm" min={filters.lensMin} max={filters.lensMax} onApply={(a, b) => set({ lensMin: a, lensMax: b })} />
          </div>
          <div>
            <div className="spec mb-1.5">Punte (DBL)</div>
            <RangeInputs key={`${filters.bridgeMin}-${filters.bridgeMax}`} label="Punte" unit="mm" min={filters.bridgeMin} max={filters.bridgeMax} onApply={(a, b) => set({ bridgeMin: a, bridgeMax: b })} />
          </div>
          <div>
            <div className="spec mb-1.5">Braț</div>
            <RangeInputs key={`${filters.templeMin}-${filters.templeMax}`} label="Braț" unit="mm" min={filters.templeMin} max={filters.templeMax} onApply={(a, b) => set({ templeMin: a, templeMax: b })} />
          </div>
        </div>
      </Group>
    </div>
  )
}

export function FilterSidebar(props: { filters: CatalogFilters; facets: Facets; category: 'optical' | 'sun' }) {
  return (
    <aside aria-label="Filtre" className="sticky top-[calc(var(--header-h)+16px)] hidden max-h-[calc(100dvh-var(--header-h)-32px)] overflow-y-auto pb-10 pr-2 [scrollbar-width:thin] lg:block">
      <Panel {...props} />
    </aside>
  )
}

export function FilterDrawerButton(props: { filters: CatalogFilters; facets: Facets; category: 'optical' | 'sun'; total: number }) {
  const ref = useRef<HTMLDialogElement>(null)
  const n = activeFilterCount(props.filters)
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className="btn btn-secondary btn-sm lg:hidden">
        <Icon name="sliders" size={18} /> Filtre{n ? ` (${n})` : ''}
      </button>
      <dialog ref={ref} aria-label="Filtre" className="m-0 mt-auto max-h-[88dvh] w-full max-w-none rounded-t-[28px] bg-glass p-0" onClick={(e) => (e.target === ref.current || (e.target as Element).closest('a')) && ref.current?.close()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-glass px-5 py-3">
          <span className="text-[17px] font-bold">Filtre</span>
          <button type="button" aria-label="Închide" onClick={() => ref.current?.close()} className="grid size-10 place-items-center rounded-full hover:bg-fog">
            <Icon name="close" />
          </button>
        </div>
        <div className="px-5 pb-28 pt-4">
          <Panel {...props} />
        </div>
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-glass p-4">
          <button type="button" onClick={() => ref.current?.close()} className="btn btn-primary w-full">
            Arată {props.total} {props.total === 1 ? 'ramă' : 'rame'}
          </button>
        </div>
      </dialog>
    </>
  )
}

export function SortSelect({ filters }: { filters: CatalogFilters }) {
  const { go } = useNav()
  return (
    <label className="flex items-center gap-2 text-[14px]">
      <span className="hidden text-graphite sm:inline">Ordonează</span>
      <select value={filters.sort} onChange={(e) => go({ ...filters, sort: e.target.value as CatalogFilters['sort'] })} className="field h-10 w-auto rounded-full pr-8 text-[14px] font-bold">
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function ActiveChips({ filters }: { filters: CatalogFilters }) {
  const { go } = useNav()
  const chips: { label: string; clear: () => void }[] = []
  const label = <T extends { value: string; label?: string; plural?: string }>(list: readonly T[], v: string) => {
    const x = list.find((i) => i.value === v)
    return (x?.plural ?? x?.label ?? v) as string
  }
  filters.shape.forEach((v) => chips.push({ label: label(SHAPES, v), clear: () => go({ ...filters, shape: filters.shape.filter((x) => x !== v) }) }))
  filters.material.forEach((v) => chips.push({ label: label(MATERIALS, v), clear: () => go({ ...filters, material: filters.material.filter((x) => x !== v) }) }))
  filters.fit.forEach((v) => chips.push({ label: `Lățime ${label(FITS, v).toLowerCase()}`, clear: () => go({ ...filters, fit: filters.fit.filter((x) => x !== v) }) }))
  filters.color.forEach((v) => chips.push({ label: label(COLOR_FAMILIES, v), clear: () => go({ ...filters, color: filters.color.filter((x) => x !== v) }) }))
  filters.audience.forEach((v) => chips.push({ label: label(AUDIENCES, v), clear: () => go({ ...filters, audience: filters.audience.filter((x) => x !== v) }) }))
  filters.feature.forEach((v) => chips.push({ label: label(FEATURES, v), clear: () => go({ ...filters, feature: filters.feature.filter((x) => x !== v) }) }))
  filters.rim.forEach((v) => chips.push({ label: label(RIMS, v), clear: () => go({ ...filters, rim: filters.rim.filter((x) => x !== v) }) }))
  if (filters.priceMin !== null || filters.priceMax !== null) chips.push({ label: `${filters.priceMin ?? 0}–${filters.priceMax ?? '∞'} lei`, clear: () => go({ ...filters, priceMin: null, priceMax: null }) })
  if (filters.lensMin !== null || filters.lensMax !== null) chips.push({ label: `Lentilă ${filters.lensMin ?? ''}–${filters.lensMax ?? ''} mm`, clear: () => go({ ...filters, lensMin: null, lensMax: null }) })
  if (filters.bridgeMin !== null || filters.bridgeMax !== null) chips.push({ label: `Punte ${filters.bridgeMin ?? ''}–${filters.bridgeMax ?? ''} mm`, clear: () => go({ ...filters, bridgeMin: null, bridgeMax: null }) })
  if (filters.templeMin !== null || filters.templeMax !== null) chips.push({ label: `Braț ${filters.templeMin ?? ''}–${filters.templeMax ?? ''} mm`, clear: () => go({ ...filters, templeMin: null, templeMax: null }) })
  if (filters.q) chips.push({ label: `„${filters.q}”`, clear: () => go({ ...filters, q: '' }) })
  if (!chips.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button key={c.label} type="button" onClick={c.clear} className="inline-flex items-center gap-1.5 rounded-full bg-paper py-1.5 pl-3.5 pr-2.5 text-[13.5px] ring-1 ring-line hover:ring-ink">
          {c.label}
          <Icon name="close" size={14} />
        </button>
      ))}
      <button
        type="button"
        onClick={() => go({ ...filters, shape: [], material: [], fit: [], color: [], audience: [], feature: [], rim: [], priceMin: null, priceMax: null, lensMin: null, lensMax: null, bridgeMin: null, bridgeMax: null, templeMin: null, templeMax: null, q: '' })}
        className="px-2 text-[13.5px] font-bold text-cobalt hover:underline"
      >
        Șterge tot
      </button>
    </div>
  )
}
