import { asc } from 'drizzle-orm'
import { Suspense } from 'react'
import { saveLensRow } from '@/app/admin/_actions/catalog-extra'
import { AdminForm } from '@/components/admin/form'
import { Badge, PageHeader, Panel } from '@/components/admin/ui'
import { db } from '@/lib/db'
import { lensIndex, lensTreatment, lensType } from '@/lib/db/schema'
import { can, requireStaff } from '@/server/session'

export const metadata = { title: 'Lentile & prețuri' }

export default function Lenses() {
  return (
    <Suspense fallback={<div className="skeleton h-[600px]" />}>
      <Tables />
    </Suspense>
  )
}

type Row = { id: string; code: string; name: string; summary: string; price: number; position: number; active: boolean; meta: string[] }

async function Tables() {
  const me = await requireStaff('orders:read')
  const writable = can(me.role, 'catalog:write')
  const [types, indices, treatments] = await Promise.all([
    db.select().from(lensType).orderBy(asc(lensType.position)),
    db.select().from(lensIndex).orderBy(asc(lensIndex.position)),
    db.select().from(lensTreatment).orderBy(asc(lensTreatment.position)),
  ])
  const groups: { kind: 'type' | 'index' | 'treatment'; title: string; note: string; rows: Row[] }[] = [
    {
      kind: 'type',
      title: 'Tipuri de lentile',
      note: 'Prețul per pereche, adăugat la ramă. „Doar rama” rămâne la 0.',
      rows: types.map((t) => ({ ...t, meta: [t.requiresPrescription ? 'necesită rețetă' : 'fără rețetă', t.requiresAdd ? 'cere ADD' : '', t.minFittingHeight ? `B ≥ ${t.minFittingHeight} mm` : '', t.categories.join(' + ')].filter(Boolean) })),
    },
    {
      kind: 'index',
      title: 'Indici de refracție',
      note: 'Suprataxă față de 1.50. Recomandarea automată din configurator ține cont de dioptrie și tipul ramei.',
      rows: indices.map((i) => ({ ...i, meta: [`n = ${i.refractiveIndex}`, i.abbe ? `Abbe ${i.abbe}` : '', i.recommendedUpTo ? `recomandat până la ±${i.recommendedUpTo} D` : 'dioptrii mari'].filter(Boolean) })),
    },
    {
      kind: 'treatment',
      title: 'Tratamente',
      note: 'Tratamentele „incluse” sunt preselectate. Cele din același grup se exclud reciproc (ex. fotocromatic / polarizat / colorat).',
      rows: treatments.map((t) => ({ ...t, meta: [t.isDefault ? 'inclus implicit' : '', t.exclusiveGroup ? `grup: ${t.exclusiveGroup}` : '', t.categories.join(' + ')].filter(Boolean) })),
    },
  ]

  return (
    <>
      <PageHeader eyebrow="Catalog" title="Lentile & prețuri">
        <p className="mt-2 max-w-2xl text-[14.5px] text-graphite">Prețurile de aici alimentează configuratorul, coșul și comenzile B2C. Modificările se aplică imediat; comenzile deja plasate își păstrează prețul.</p>
      </PageHeader>
      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <Panel key={g.kind} title={g.title} pad={false}>
            <p className="border-b border-line-soft px-5 py-3 text-[13.5px] text-graphite">{g.note}</p>
            <ul className="divide-y divide-line-soft">
              {g.rows.map((r) => (
                <li key={r.id} className="px-5 py-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[12px] text-graphite">{r.code}</span>
                    {r.active ? null : <Badge tone="warn">inactiv</Badge>}
                    {r.meta.map((m) => <span key={m} className="text-[12.5px] text-graphite">· {m}</span>)}
                  </div>
                  {writable ? (
                    <AdminForm action={saveLensRow.bind(null, g.kind, r.id)} inline>
                      <label className="flex w-48 flex-col gap-1 text-[12.5px] font-bold">Nume<input name="name" defaultValue={r.name} className="field h-10 text-[14px] font-normal" /></label>
                      <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-[12.5px] font-bold">Descriere scurtă<input name="summary" defaultValue={r.summary} className="field h-10 text-[14px] font-normal" /></label>
                      <label className="flex w-28 flex-col gap-1 text-[12.5px] font-bold">Preț (lei)<input name="price" type="number" min={0} step={1} defaultValue={r.price / 100} className="field h-10 text-[14px] font-normal tnum" /></label>
                      <label className="flex w-20 flex-col gap-1 text-[12.5px] font-bold">Ordine<input name="position" type="number" min={0} defaultValue={r.position} className="field h-10 text-[14px] font-normal tnum" /></label>
                      <label className="flex h-10 items-center gap-2 text-[13.5px]"><input type="checkbox" name="active" defaultChecked={r.active} className="size-4 accent-cobalt" /> Activ</label>
                    </AdminForm>
                  ) : (
                    <div className="flex justify-between text-[14px]"><span><strong>{r.name}</strong> — {r.summary}</span><span className="tnum">{r.price / 100} lei</span></div>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </>
  )
}
