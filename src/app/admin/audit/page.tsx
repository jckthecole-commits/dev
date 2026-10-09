import { and, desc, eq, ilike, lt, type SQL } from 'drizzle-orm'
import Link from 'next/link'
import { Suspense } from 'react'
import { Empty, PageHeader, Panel, Table } from '@/components/admin/ui'
import { db } from '@/lib/db'
import { auditLog } from '@/lib/db/schema'
import { formatDateTime } from '@/lib/format'
import { requireStaff } from '@/server/session'

export const metadata = { title: 'Jurnal de audit' }
const PER = 50

const ENTITY: Record<string, string> = { order: 'Comenzi', prescription: 'Rețete', product: 'Produse', partner: 'Parteneri', user: 'Utilizatori', setting: 'Setări', appointment: 'Programări', coupon: 'Cupoane', review: 'Recenzii', post: 'Conținut' }

export default function Audit({ searchParams }: Pick<PageProps<'/admin/audit'>, 'searchParams'>) {
  return (
    <Suspense fallback={<div className="skeleton h-[600px]" />}>
      <Log searchParams={searchParams} />
    </Suspense>
  )
}

async function Log({ searchParams }: Pick<PageProps<'/admin/audit'>, 'searchParams'>) {
  await requireStaff('reports:read')
  const sp = await searchParams
  const entity = typeof sp.entity === 'string' && sp.entity in ENTITY ? sp.entity : ''
  const actor = typeof sp.actor === 'string' ? sp.actor.trim() : ''
  const before = typeof sp.inainte === 'string' && !Number.isNaN(Date.parse(sp.inainte)) ? new Date(sp.inainte) : null
  const where: SQL[] = []
  if (entity) where.push(eq(auditLog.entity, entity))
  if (actor) where.push(ilike(auditLog.actorEmail, `%${actor}%`))
  if (before) where.push(lt(auditLog.createdAt, before))
  const rows = await db.select().from(auditLog).where(and(...where)).orderBy(desc(auditLog.createdAt)).limit(PER + 1)
  const more = rows.length > PER
  const list = rows.slice(0, PER)
  const qs = (patch: Record<string, string>) => {
    const u = new URLSearchParams({ ...(entity && { entity }), ...(actor && { actor }), ...patch })
    for (const [k, v] of [...u.entries()]) if (!v) u.delete(k)
    return `/admin/audit?${u}`
  }
  return (
    <>
      <PageHeader eyebrow="Platformă" title="Jurnal de audit">
        <p className="mt-2 max-w-2xl text-[14.5px] text-graphite">Cine a făcut ce și când: accesări de rețete (date medicale, art. 9 GDPR), schimbări de status, prețuri, setări, roluri. Înregistrările nu pot fi editate din aplicație.</p>
      </PageHeader>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Link href={qs({ entity: '', inainte: '' })} aria-current={!entity ? 'page' : undefined} className="tab-pill">Toate</Link>
        {Object.entries(ENTITY).map(([k, l]) => <Link key={k} href={qs({ entity: k, inainte: '' })} aria-current={entity === k ? 'page' : undefined} className="tab-pill">{l}</Link>)}
        <form action="/admin/audit" className="ml-auto">
          {entity ? <input type="hidden" name="entity" value={entity} /> : null}
          <input type="search" name="actor" defaultValue={actor} placeholder="E-mail utilizator" aria-label="Filtrează după utilizator" className="field h-10 w-60 text-[14px]" />
        </form>
      </div>
      <Panel pad={false}>
        {list.length ? (
          <Table>
            <thead><tr><th>Când</th><th>Cine</th><th>Acțiune</th><th>Obiect</th><th>Detalii</th></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="whitespace-nowrap font-mono text-[12.5px]">{formatDateTime(r.createdAt)}</td>
                  <td className="text-[13.5px]">{r.actorEmail ?? <span className="text-graphite">sistem</span>}{r.ip ? <div className="font-mono text-[11.5px] text-graphite">{r.ip}</div> : null}</td>
                  <td><code className={`rounded-md px-1.5 py-0.5 font-mono text-[12px] ${r.action.startsWith('rx.') || r.action.startsWith('gdpr.') ? 'bg-warn-50 text-warn' : 'bg-fog'}`}>{r.action}</code></td>
                  <td className="text-[13px]">
                    {r.entity === 'order' && r.entityId ? <Link href={`/admin/comenzi/${r.entityId}`} className="text-cobalt">comandă</Link> : r.entity === 'product' && r.entityId ? <Link href={`/admin/produse/${r.entityId}`} className="text-cobalt">produs</Link> : r.entity}
                    {r.entityId ? <div className="font-mono text-[11px] text-graphite">{r.entityId.slice(0, 13)}</div> : null}
                  </td>
                  <td className="max-w-[420px]">{r.data ? <details><summary className="cursor-pointer text-[12.5px] text-graphite">date</summary><pre className="mt-1 max-h-60 overflow-auto rounded-lg bg-fog p-2 text-[11.5px]">{JSON.stringify(r.data, null, 2)}</pre></details> : null}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty icon="list" title="Nicio înregistrare" />
        )}
        {more ? <div className="border-t border-line-soft p-3 text-right"><Link href={qs({ inainte: list.at(-1)!.createdAt.toISOString() })} className="btn btn-secondary btn-sm">Mai vechi</Link></div> : null}
      </Panel>
    </>
  )
}
