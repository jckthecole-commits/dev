'use client'

import { useState } from 'react'
import type { FormResult } from '@/components/admin/form'
import { FrameArt } from '@/components/frame-art'
import { Icon } from '@/components/icons'
import { cn } from '@/lib/cn'
import type { Swatch } from '@/lib/db/schema'
import { lensOutline, pathFromPoints, type Shape } from '@/lib/frame-geometry'
import { swatchCss } from '@/lib/product-art'
import { COLOR_FAMILIES, colorCodeOf, frameWidthOf, highlightsOf, metaOf, modelCodeOf, productNameOf, SHAPE_LABEL, skuOf } from '@/lib/product-derive'
import type { VariantInput } from '@/lib/product-input'
import { newVariant, type EditorLocation, type EditorReserved, type EditorState as State, type Num } from '@/lib/product-editor-state'
import { slugify } from '@/lib/text'
import { useActionForm } from '@/lib/use-action-form'

const METALS = [
  ['gold', 'Auriu'],
  ['silver', 'Argintiu'],
  ['gunmetal', 'Gunmetal'],
  ['black', 'Negru metalic'],
  ['rose', 'Auriu roz'],
] as const
const SHAPES = Object.keys(SHAPE_LABEL) as Shape[]
const field = 'field h-11 text-[14.5px]'

export function ProductEditor({
  initial,
  locations,
  reserved = {},
  action,
  isNew,
  slug: savedSlug,
}: {
  initial: State
  locations: EditorLocation[]
  reserved?: EditorReserved
  action: (s: FormResult, fd: FormData) => Promise<FormResult>
  isNew: boolean
  slug?: string
}) {
  const [s, setS] = useState<State>(initial)
  const [active, setActive] = useState(0)
  // new colours get their database ids back, so the next save updates instead of inserting
  const [state, onSubmit, pending] = useActionForm(async (prev: FormResult, fd: FormData) => {
    const r = await action(prev, fd)
    const ids = (r as { variantIds?: string[] } | null)?.variantIds
    if (ids) setS((p) => ({ ...p, variants: p.variants.map((v, i) => (v.id || !ids[i] ? v : { ...v, id: ids[i] })) }))
    return r
  }, null)
  const errs = state?.fieldErrors ?? {}
  const err = (k: string) => errs[k]
  const set = <K extends keyof State>(k: K, v: State[K]) => setS((p) => ({ ...p, [k]: v }))
  const setGeo = (patch: Partial<State['geometry']>) => setS((p) => ({ ...p, geometry: { ...p.geometry, ...patch } }))
  const setVar = (i: number, patch: Partial<VariantInput>) => setS((p) => ({ ...p, variants: p.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) }))
  const setSwatch = (i: number, patch: Partial<Swatch>) => setS((p) => ({ ...p, variants: p.variants.map((v, j) => (j === i ? { ...v, swatch: { ...v.swatch, ...patch } } : v)) }))

  const num = (v: Num, d: number) => (v === '' ? d : v)
  const dims = { lensWidth: num(s.lensWidth, 52), bridgeWidth: num(s.bridgeWidth, 18), templeLength: num(s.templeLength, 145), lensHeight: num(s.lensHeight, 38) }
  const name = s.family ? productNameOf({ family: s.family, lensWidth: dims.lensWidth }) : 'Model nou'
  const modelCode = s.family ? modelCodeOf({ family: s.family, lensWidth: dims.lensWidth, category: s.category }) : '—'
  const autoSlug = slugify(name)
  const priceBani = Math.round(num(s.price, 0) * 100)
  const meta = metaOf({ name, category: s.category, material: s.material, ...dims, weightGrams: s.weightGrams === '' ? null : s.weightGrams, tagline: s.tagline, price: priceBani })
  const autoHighlights = highlightsOf({ ...dims, weightGrams: s.weightGrams === '' ? null : s.weightGrams, material: s.material, category: s.category, polarized: s.polarized, filterCategory: s.filterCategory })
  const v = s.variants[Math.min(active, s.variants.length - 1)]!
  const spec = { shape: s.shape, ...dims, rim: s.rim, material: s.material, geometry: s.geometry, category: s.category }
  const net = num(s.price, 0) / (s.vatClass === 'standard' ? 1.21 : s.vatClass === 'reduced' ? 1.11 : 1)
  const ws = num(s.wholesalePrice, 0)
  const margin = ws && net ? ((net - ws) / net) * 100 : null

  const onMaterial = (m: State['material']) =>
    setS((p) => ({
      ...p,
      material: m,
      geometry: m === 'metal' || m === 'titan' ? { ...p.geometry, rim: 1.3, bridgeStyle: p.geometry.bridgeStyle === 'keyhole' ? 'saddle' : p.geometry.bridgeStyle, pads: true } : m === 'acetat' || m === 'tr90' ? { ...p.geometry, rim: 4.6, bridgeStyle: p.geometry.bridgeStyle === 'saddle' ? 'keyhole' : p.geometry.bridgeStyle, pads: false } : p.geometry,
    }))

  return (
    <form onSubmit={onSubmit} className="pb-28">
      <input type="hidden" name="payload" value={JSON.stringify(s)} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col gap-6">
          <Section title="Model" id="model">
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="Familie (numele colecției)" error={err('family')} hint={`Nume afișat: ${name}`}>
                <input value={s.family} onChange={(e) => set('family', e.target.value)} className={field} placeholder="ex. Mira" required />
              </F>
              <F label="Adresă (slug)" error={err('slug')} hint={`/rame/${s.slug || autoSlug}`}>
                <input value={s.slug ?? ''} onChange={(e) => set('slug', slugify(e.target.value))} className={field} placeholder={autoSlug} />
              </F>
              <F label="Categorie">
                <Seg value={s.category} onChange={(c) => set('category', c)} options={[['optical', 'Rame de vedere'], ['sun', 'Ochelari de soare']]} />
              </F>
              <F label="Status">
                <Seg value={s.status} onChange={(c) => set('status', c)} options={[['draft', 'Ciornă'], ['active', 'Publicat'], ['archived', 'Arhivat']]} />
              </F>
              <F label="Pentru">
                <select value={s.audience} onChange={(e) => set('audience', e.target.value as State['audience'])} className={field}>
                  <option value="unisex">Unisex</option><option value="women">Femei</option><option value="men">Bărbați</option><option value="kids">Copii</option>
                </select>
              </F>
              <F label="Etichetă (opțional)" hint="ex. Nou, Bestseller, Ediție limitată">
                <input value={s.badge ?? ''} onChange={(e) => set('badge', e.target.value)} className={field} maxLength={24} />
              </F>
            </div>
            <label className="mt-4 flex items-center gap-2 text-[14px]"><input type="checkbox" checked={s.featured} onChange={(e) => set('featured', e.target.checked)} className="size-4 accent-cobalt" /> Recomandat pe prima pagină</label>
          </Section>

          <Section title="Formă & dimensiuni" id="dimensiuni">
            <div className="mb-5 grid grid-cols-4 gap-2 sm:grid-cols-8">
              {SHAPES.map((sh) => {
                const pts = lensOutline({ shape: sh, lensWidth: 50, lensHeight: sh === 'round' ? 46 : sh === 'pilot' ? 44 : 36, geometry: { rim: 4, bridgeStyle: 'keyhole', lift: sh === 'cat-eye' ? 0.6 : sh === 'pilot' ? 0.5 : undefined } }, 72)
                return (
                  <button key={sh} type="button" onClick={() => set('shape', sh)} aria-pressed={s.shape === sh} className={cn('flex flex-col items-center gap-1 rounded-2xl p-2 text-[11.5px] ring-1 transition', s.shape === sh ? 'bg-cobalt-50 font-bold text-cobalt ring-cobalt' : 'ring-line-soft hover:ring-line')}>
                    <svg viewBox="-30 -28 60 56" className="h-8 w-10" aria-hidden><path d={pathFromPoints(pts)} fill="none" stroke="currentColor" strokeWidth="3.5" /></svg>
                    {SHAPE_LABEL[sh]}
                  </button>
                )
              })}
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <F label="A · lentilă" error={err('lensWidth')}><NumIn value={s.lensWidth} onChange={(x) => set('lensWidth', x)} suffix="mm" /></F>
              <F label="DBL · punte" error={err('bridgeWidth')}><NumIn value={s.bridgeWidth} onChange={(x) => set('bridgeWidth', x)} suffix="mm" /></F>
              <F label="Braț" error={err('templeLength')}><NumIn value={s.templeLength} onChange={(x) => set('templeLength', x)} suffix="mm" /></F>
              <F label="B · înălțime" error={err('lensHeight')}><NumIn value={s.lensHeight} onChange={(x) => set('lensHeight', x)} suffix="mm" /></F>
              <F label="Greutate" error={err('weightGrams')}><NumIn value={s.weightGrams} onChange={(x) => set('weightGrams', x)} suffix="g" step={0.5} /></F>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <F label="Material">
                <select value={s.material} onChange={(e) => onMaterial(e.target.value as State['material'])} className={field}>
                  <option value="acetat">Acetat</option><option value="metal">Metal</option><option value="titan">Titan</option><option value="tr90">TR90</option><option value="combinat">Combinat (acetat + metal)</option>
                </select>
              </F>
              <F label="Tip ramă">
                <select value={s.rim} onChange={(e) => set('rim', e.target.value as State['rim'])} className={field}>
                  <option value="full">Ramă întreagă</option><option value="semi">Semi-ramă (nylor)</option><option value="rimless">Fără ramă (găurită)</option>
                </select>
              </F>
              <F label="Punte">
                <select value={s.geometry.bridgeStyle} onChange={(e) => setGeo({ bridgeStyle: e.target.value as State['geometry']['bridgeStyle'] })} className={field}>
                  <option value="keyhole">Keyhole</option><option value="saddle">Șa</option><option value="double">Dublă (aviator)</option><option value="straight">Dreaptă</option>
                </select>
              </F>
            </div>
            <div className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Range label="Grosime ramă" value={s.geometry.rim} min={0.8} max={7} step={0.1} unit="mm" onChange={(x) => setGeo({ rim: x })} />
              <Range label="Tensiune formă" value={s.geometry.tension ?? 0} min={0} max={7} step={0.1} unit="" auto onChange={(x) => setGeo({ tension: x < 1.6 ? undefined : x })} />
              {s.shape === 'cat-eye' || s.shape === 'pilot' ? <Range label={s.shape === 'pilot' ? 'Coborâre aviator' : 'Ridicare cat-eye'} value={s.geometry.lift ?? 0} min={0} max={1} step={0.05} unit="" onChange={(x) => setGeo({ lift: x })} /> : null}
              {s.shape === 'browline' ? <Range label="Greutate sprânceană" value={s.geometry.browWeight ?? 1.6} min={1} max={3} step={0.1} unit="×" onChange={(x) => setGeo({ browWeight: x })} /> : null}
              <label className="flex items-center gap-2 self-end text-[14px]"><input type="checkbox" checked={!!s.geometry.pads} onChange={(e) => setGeo({ pads: e.target.checked })} className="size-4 accent-cobalt" /> Plăcuțe nazale</label>
            </div>
            {s.category === 'sun' ? (
              <div className="mt-5 grid gap-4 border-t border-line-soft pt-5 sm:grid-cols-2">
                <F label="Categoria filtrului (EN ISO 12312-1)" error={err('filterCategory')}>
                  <select value={s.filterCategory ?? ''} onChange={(e) => set('filterCategory', e.target.value === '' ? null : Number(e.target.value))} className={field}>
                    <option value="">Alege</option>
                    {[0, 1, 2, 3, 4].map((c) => <option key={c} value={c}>Cat. {c}{c === 4 ? ' — nu pentru condus' : c === 3 ? ' — soare puternic' : ''}</option>)}
                  </select>
                </F>
                <label className="flex items-center gap-2 self-end pb-3 text-[14px]"><input type="checkbox" checked={s.polarized} onChange={(e) => set('polarized', e.target.checked)} className="size-4 accent-cobalt" /> Lentile polarizate</label>
              </div>
            ) : null}
          </Section>

          <Section title={`Culori & stoc · ${s.variants.length}`} id="variante">
            {err('variants') ? <p className="mb-3 text-[13.5px] text-err">{err('variants')}</p> : null}
            <div className="flex flex-col gap-4">
              {s.variants.map((vv, i) => {
                const sku = s.family && vv.colorCode ? skuOf(modelCode, vv.colorCode) : '—'
                const ve = (k: string) => err(`variants.${i}.${k}`)
                return (
                  <div key={vv.id ?? `n${i}`} className={cn('rounded-2xl p-4 ring-1', active === i ? 'ring-cobalt' : 'ring-line-soft', !vv.active && 'opacity-60')} onFocusCapture={() => setActive(i)}>
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="button" onClick={() => setActive(i)} className="size-9 shrink-0 rounded-full ring-2 ring-glass ring-offset-1 ring-offset-line" style={{ background: swatchCss(vv.swatch) }} aria-label={`Previzualizează ${vv.colorName || 'culoarea'}`} />
                      <span className="font-mono text-[12.5px] text-graphite">{sku}</span>
                      <label className="ml-auto flex items-center gap-1.5 text-[13px]"><input type="radio" name="default-variant" checked={!!vv.isDefault} onChange={() => setS((p) => ({ ...p, variants: p.variants.map((x, j) => ({ ...x, isDefault: j === i })) }))} className="accent-cobalt" /> Implicită</label>
                      <label className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" checked={vv.active} onChange={(e) => setVar(i, { active: e.target.checked })} className="accent-cobalt" /> Activă</label>
                      {s.variants.length > 1 && !vv.id ? (
                        <button type="button" onClick={() => { setS((p) => ({ ...p, variants: p.variants.filter((_, j) => j !== i) })); setActive(0) }} className="btn btn-ghost btn-sm" aria-label="Elimină culoarea"><Icon name="trash" size={15} /></button>
                      ) : null}
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 2xl:grid-cols-[1.3fr_84px_1fr_1.2fr]">
                      <F label="Culoare" error={ve('colorName')}>
                        <input value={vv.colorName} onChange={(e) => setVar(i, { colorName: e.target.value, ...(vv.id ? {} : { colorCode: colorCodeOf(e.target.value) }) })} className={field} placeholder="ex. Havana miere" />
                      </F>
                      <F label="Cod" error={ve('colorCode')}><input value={vv.colorCode} onChange={(e) => setVar(i, { colorCode: e.target.value.toUpperCase().slice(0, 5) })} className={cn(field, 'font-mono uppercase')} /></F>
                      <F label="Filtru culoare">
                        <select value={vv.colorFamily} onChange={(e) => setVar(i, { colorFamily: e.target.value as VariantInput['colorFamily'] })} className={field}>{COLOR_FAMILIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                      </F>
                      <F label="Finisaj">
                        <select value={vv.swatch.kind} onChange={(e) => { const k = e.target.value as Swatch['kind']; setSwatch(i, { kind: k, primary: k === 'metal' ? 'gold' : vv.swatch.primary.startsWith('#') ? vv.swatch.primary : '#15181B' }) }} className={field}>
                          <option value="solid">Opac</option><option value="crystal">Cristal / translucid</option><option value="havana">Havana (baga)</option><option value="gradient">Degradé</option><option value="metal">Metal</option>
                        </select>
                      </F>
                    </div>
                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      {vv.swatch.kind === 'metal' ? (
                        <F label="Metal"><select value={vv.swatch.primary} onChange={(e) => setSwatch(i, { primary: e.target.value })} className={field}>{METALS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></F>
                      ) : (
                        <Color label="Culoare de bază" value={vv.swatch.primary} onChange={(c) => setSwatch(i, { primary: c })} />
                      )}
                      {vv.swatch.kind === 'havana' || vv.swatch.kind === 'gradient' ? <Color label={vv.swatch.kind === 'havana' ? 'Pete' : 'Spre'} value={vv.swatch.secondary ?? '#C08A45'} onChange={(c) => setSwatch(i, { secondary: c })} /> : null}
                      {vv.swatch.kind === 'solid' ? (
                        <F label="Accent metalic"><select value={vv.swatch.secondary ?? ''} onChange={(e) => setSwatch(i, { secondary: e.target.value || undefined })} className={field}><option value="">Fără</option><option value="gold">Auriu</option><option value="silver">Argintiu</option></select></F>
                      ) : null}
                      {s.category === 'sun' ? (
                        <>
                          <Color label="Lentilă" value={vv.swatch.lens ?? '#2F3A36'} onChange={(c) => setSwatch(i, { lens: c })} />
                          <label className="flex items-center gap-1.5 pb-3 text-[13px]"><input type="checkbox" checked={!!vv.swatch.lensGradient} onChange={(e) => setSwatch(i, { lensGradient: e.target.checked })} className="accent-cobalt" /> degradé</label>
                        </>
                      ) : null}
                      <F label="Diferență preț" className="w-32"><NumIn value={vv.priceDelta ?? 0} onChange={(x) => setVar(i, { priceDelta: x === '' ? 0 : x })} suffix="lei" step={1} allowNegative /></F>
                      <F label="EAN / GTIN" error={ve('ean')} className="w-44"><input value={vv.ean ?? ''} onChange={(e) => setVar(i, { ean: e.target.value.replace(/\D/g, '') })} className={cn(field, 'font-mono')} inputMode="numeric" /></F>
                    </div>
                    <table className="mt-4 w-full text-[13.5px]">
                      <thead><tr className="text-left font-mono text-[11px] uppercase tracking-[0.08em] text-graphite"><th className="py-1 font-normal">Locație</th><th className="font-normal">În stoc</th><th className="font-normal">Rezervat</th><th className="font-normal">Prag alertă</th></tr></thead>
                      <tbody>
                        {locations.map((l) => {
                          const st = vv.stock[l.id] ?? { onHand: 0, reorderPoint: 2 }
                          const res = vv.id ? (reserved[vv.id]?.[l.id] ?? 0) : 0
                          const upd = (patch: Partial<typeof st>) => setVar(i, { stock: { ...vv.stock, [l.id]: { ...st, ...patch } } })
                          return (
                            <tr key={l.id} className="border-t border-line-soft">
                              <td className="py-2 pr-3">{l.name}</td>
                              <td className="pr-3"><input type="number" min={res} value={st.onHand} onChange={(e) => upd({ onHand: Math.max(0, Number(e.target.value)) })} className="field h-9 w-24 text-[14px] tnum" aria-label={`Stoc ${l.name}`} /></td>
                              <td className="pr-3 tnum text-graphite">{res}</td>
                              <td><input type="number" min={0} value={st.reorderPoint} onChange={(e) => upd({ reorderPoint: Math.max(0, Number(e.target.value)) })} className="field h-9 w-20 text-[14px] tnum" aria-label={`Prag ${l.name}`} /></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })}
            </div>
            <button type="button" onClick={() => { setS((p) => ({ ...p, variants: [...p.variants, newVariant(locations)] })); setActive(s.variants.length) }} className="btn btn-secondary btn-sm mt-4"><Icon name="plus" size={16} /> Adaugă culoare</button>
          </Section>

          <Section title="Prețuri" id="preturi">
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
              <F label="Preț (cu TVA)" error={err('price')}><NumIn value={s.price} onChange={(x) => set('price', x)} suffix="lei" step={1} /></F>
              <F label="Preț vechi (tăiat)" error={err('compareAtPrice')} hint="Ultimul preț din 30 de zile (Directiva Omnibus)"><NumIn value={s.compareAtPrice} onChange={(x) => set('compareAtPrice', x)} suffix="lei" step={1} /></F>
              <F label="Preț en-gros (fără TVA)" error={err('wholesalePrice')} hint={margin !== null ? `Marjă partener ≈ ${margin.toFixed(0)}% din prețul net de raft` : 'Vizibil doar partenerilor B2B'}><NumIn value={s.wholesalePrice} onChange={(x) => set('wholesalePrice', x)} suffix="lei" step={1} /></F>
              <F label="Cotă TVA">
                <select value={s.vatClass} onChange={(e) => set('vatClass', e.target.value as State['vatClass'])} className={field}>
                  <option value="standard">Standard (21%)</option><option value="reduced">Redusă (11%)</option><option value="exempt">Scutit</option>
                </select>
              </F>
            </div>
          </Section>

          <Section title="Conținut" id="continut">
            <div className="flex flex-col gap-4">
              <F label="Slogan (sub nume)" hint={`${(s.tagline ?? '').length}/140`}><input value={s.tagline ?? ''} onChange={(e) => set('tagline', e.target.value)} className={field} maxLength={140} /></F>
              <F label="Descriere" hint="Markdown simplu. Scrie despre senzație, nu doar despre specificații."><textarea value={s.description ?? ''} onChange={(e) => set('description', e.target.value)} rows={7} className="field h-auto py-3 text-[14.5px] leading-relaxed" /></F>
              <div className="grid gap-4 sm:grid-cols-2">
                <F label="Puncte cheie (unul pe rând)" hint="Gol = generate automat din dimensiuni"><textarea value={s.highlights.join('\n')} onChange={(e) => set('highlights', e.target.value.split('\n').filter((x, i, a) => x.trim() || i < a.length - 1))} rows={4} className="field h-auto py-2.5 text-[14px]" placeholder={autoHighlights.join('\n')} /></F>
                <F label="Caracteristici (unul pe rând)" hint="ex. flex, Acetat Mazzucchelli"><textarea value={s.features.join('\n')} onChange={(e) => set('features', e.target.value.split('\n').filter((x, i, a) => x.trim() || i < a.length - 1))} rows={4} className="field h-auto py-2.5 text-[14px]" /></F>
              </div>
            </div>
          </Section>

          <Section title="Conformitate (MDR / GPSR)" id="conformitate">
            <div className="grid gap-4 sm:grid-cols-3">
              <F label="Producător"><input value={s.manufacturer ?? ''} onChange={(e) => set('manufacturer', e.target.value)} className={field} /></F>
              <F label="Țara de origine"><input value={s.countryOfOrigin ?? ''} onChange={(e) => set('countryOfOrigin', e.target.value)} className={field} /></F>
              <F label="Marcaj CE" hint="Gol = text standard pe categorie"><input value={s.ceMarking ?? ''} onChange={(e) => set('ceMarking', e.target.value)} className={field} placeholder={s.category === 'sun' ? 'CE · EN ISO 12312-1 · UV400' : 'CE · dispozitiv medical clasa I'} /></F>
            </div>
          </Section>

          <Section title="Google & rețele" id="seo">
            <div className="grid gap-4">
              <F label="Titlu SEO" hint={`${(s.metaTitle || meta.title).length}/60 recomandat`}><input value={s.metaTitle ?? ''} onChange={(e) => set('metaTitle', e.target.value)} className={field} placeholder={meta.title} maxLength={90} /></F>
              <F label="Descriere SEO" hint={`${(s.metaDescription || meta.description).length}/155 recomandat`}><textarea value={s.metaDescription ?? ''} onChange={(e) => set('metaDescription', e.target.value)} rows={3} className="field h-auto py-2.5 text-[14px]" placeholder={meta.description} maxLength={200} /></F>
              <div className="rounded-2xl bg-paper p-4 ring-1 ring-line-soft">
                <div className="text-[12.5px] text-graphite">sifravision.ro › rame › {s.slug || autoSlug}</div>
                <div className="mt-0.5 line-clamp-1 text-[18px] text-[#1a0dab]">{s.metaTitle || meta.title} | Sifra Vision</div>
                <div className="line-clamp-2 text-[13.5px] text-ink-2">{s.metaDescription || meta.description}</div>
              </div>
            </div>
          </Section>
        </div>

        <aside className="xl:sticky xl:top-20 xl:self-start">
          <div className="overflow-hidden rounded-[24px] bg-glass ring-1 ring-line-soft">
            <div className="relative bg-[radial-gradient(120%_90%_at_50%_0%,#fff,var(--color-fog))] px-6 pb-4 pt-8">
              <FrameArt product={spec} swatch={v.swatch} className="h-auto w-full" shadow temples idSalt="editor" title={`${name} · ${v.colorName}`} />
              <span className="absolute left-4 top-4 font-mono text-[11px] uppercase tracking-[0.12em] text-graphite">Previzualizare la scară</span>
            </div>
            <div className="flex flex-wrap justify-center gap-2 border-t border-line-soft p-3">
              {s.variants.map((x, i) => (
                <button key={i} type="button" onClick={() => setActive(i)} title={x.colorName} aria-label={x.colorName || `Culoare ${i + 1}`} aria-pressed={active === i} className={cn('size-7 rounded-full ring-1 ring-line transition', active === i && 'ring-2 ring-cobalt ring-offset-2 ring-offset-glass')} style={{ background: swatchCss(x.swatch) }} />
              ))}
            </div>
            <dl className="grid grid-cols-2 gap-px border-t border-line-soft bg-line-soft text-[13px]">
              {[
                ['Nume', name],
                ['Cod model', modelCode],
                ['Mărime', `${dims.lensWidth}□${dims.bridgeWidth} ${dims.templeLength}`],
                ['Lățime totală', `≈ ${frameWidthOf({ ...dims, material: s.material })} mm`],
                ['Înălțime B', `${dims.lensHeight} mm${dims.lensHeight >= 28 && s.category === 'optical' ? ' · progresiv OK' : ''}`],
                ['Preț', priceBani ? `${num(s.price, 0)} lei` : '—'],
              ].map(([k, val]) => (
                <div key={k} className="bg-glass px-4 py-2.5"><dt className="text-graphite">{k}</dt><dd className="font-bold">{val}</dd></div>
              ))}
            </dl>
          </div>
          {!isNew && savedSlug ? (
            <a href={`/rame/${savedSlug}`} target="_blank" className="mt-3 flex items-center justify-center gap-1.5 text-[13.5px] font-bold text-cobalt"><Icon name="external" size={15} /> Vezi pagina din magazin</a>
          ) : null}
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-glass/90 backdrop-blur lg:left-[256px]">
        <div className="flex items-center gap-4 px-5 py-3 lg:px-10">
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? 'Se salvează…' : isNew ? 'Creează produsul' : 'Salvează modificările'}</button>
          {state ? <span role="status" className={cn('text-[14px]', state.ok ? 'text-ok' : 'text-err')}>{state.ok ? state.message : state.error}</span> : <span className="text-[13.5px] text-graphite">Salvarea actualizează imediat magazinul și feed-ul Google.</span>}
          {state && !state.ok && Object.keys(errs).length ? <span className="ml-auto hidden max-w-[50%] truncate text-[13px] text-err md:inline">{Object.values(errs).join(' · ')}</span> : null}
        </div>
      </div>
    </form>
  )
}

function Section({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-[20px] bg-glass p-5 ring-1 ring-line-soft sm:p-6">
      <h2 className="mb-5 text-[16px] font-bold">{title}</h2>
      {children}
    </section>
  )
}

function F({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="text-[13px] font-bold">{label}</span>
      {children}
      {error ? <span className="text-[12.5px] text-err">{error}</span> : hint ? <span className="truncate text-[12.5px] text-graphite">{hint}</span> : null}
    </label>
  )
}

function NumIn({ value, onChange, suffix, step = 1, allowNegative }: { value: Num; onChange: (v: Num) => void; suffix?: string; step?: number; allowNegative?: boolean }) {
  return (
    <span className="relative flex items-center">
      <input type="number" inputMode="decimal" step={step} min={allowNegative ? undefined : 0} value={value} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} className={cn(field, 'w-full pr-11 tnum')} />
      {suffix ? <span className="pointer-events-none absolute right-3.5 text-[13px] text-graphite">{suffix}</span> : null}
    </span>
  )
}

function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <span className="flex rounded-full bg-fog p-1 ring-1 ring-line-soft">
      {options.map(([k, l]) => (
        <button key={k} type="button" onClick={() => onChange(k)} aria-pressed={value === k} className={cn('h-9 flex-1 rounded-full px-3 text-[13.5px] transition', value === k ? 'bg-ink font-bold text-fog' : 'hover:bg-glass')}>{l}</button>
      ))}
    </span>
  )
}

function Range({ label, value, min, max, step, unit, onChange, auto }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void; auto?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex justify-between text-[13px]"><span className="font-bold">{label}</span><span className="font-mono tnum text-graphite">{auto && value < 1.6 ? 'auto' : `${value.toFixed(step < 0.1 ? 2 : 1)}${unit}`}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-cobalt" />
    </label>
  )
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'
  return (
    <span className="flex flex-col gap-1.5">
      <span className="text-[13px] font-bold">{label}</span>
      <span className="flex h-11 items-center gap-2 rounded-[14px] bg-paper px-2 ring-1 ring-line">
        <input type="color" value={safe} onChange={(e) => onChange(e.target.value.toUpperCase())} className="size-7 cursor-pointer rounded-md border-0 bg-transparent p-0" aria-label={label} />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="w-[76px] bg-transparent font-mono text-[13px] uppercase outline-none" aria-label={`${label} hex`} />
      </span>
    </span>
  )
}
