import { desc, eq, inArray, sql } from 'drizzle-orm'
import Link from 'next/link'
import { Suspense } from 'react'
import { reviewPrescription } from '@/app/admin/_actions/orders'
import { AdminForm } from '@/components/admin/form'
import { Badge, Empty, Field, input, PageHeader, Panel } from '@/components/admin/ui'
import { Icon } from '@/components/icons'
import { decryptJson } from '@/lib/crypto'
import { db } from '@/lib/db'
import { order, orderItem, prescription, user } from '@/lib/db/schema'
import { formatDateTime } from '@/lib/format'
import { formatDiopter, validateRx, type RxValues } from '@/lib/optics'
import { audit } from '@/server/audit'
import { can, requireStaff } from '@/server/session'

export const metadata = { title: 'Rețete' }

const TABS = [
  { key: 'pending', label: 'De verificat' },
  { key: 'needs_info', label: 'Așteaptă clarificări' },
  { key: 'verified', label: 'Verificate' },
  { key: 'rejected', label: 'Respinse' },
] as const
type TabKey = (typeof TABS)[number]['key']

export default function RxQueue({ searchParams }: Pick<PageProps<'/admin/retete'>, 'searchParams'>) {
  return (
    <Suspense fallback={<div className="skeleton h-[480px]" />}>
      <Queue searchParams={searchParams} />
    </Suspense>
  )
}

async function Queue({ searchParams }: Pick<PageProps<'/admin/retete'>, 'searchParams'>) {
  const me = await requireStaff('orders:read')
  const sp = await searchParams
  const tab: TabKey = TABS.some((t) => t.key === sp.status) ? (sp.status as TabKey) : 'pending'
  const canVerify = can(me.role, 'rx:verify')

  const [rows, counts] = await Promise.all([
    db
      .select({ rx: prescription, orderId: order.id, number: order.number, customer: order.customerName, lensType: sql<string | null>`${orderItem.configuration}->>'lensType'`, product: orderItem.productName, account: user.name })
      .from(prescription)
      .leftJoin(orderItem, eq(orderItem.prescriptionId, prescription.id))
      .leftJoin(order, eq(order.id, orderItem.orderId))
      .leftJoin(user, eq(user.id, prescription.userId))
      .where(eq(prescription.status, tab))
      .orderBy(tab === 'pending' ? prescription.createdAt : desc(prescription.updatedAt))
      .limit(tab === 'pending' || tab === 'needs_info' ? 100 : 40),
    db.select({ status: prescription.status, n: sql<number>`count(*)::int` }).from(prescription).where(inArray(prescription.status, ['pending', 'needs_info'])).groupBy(prescription.status),
  ])
  if (rows.length) await audit(me, 'rx.list', 'prescription', null, { tab, n: rows.length })
  const count = (k: string) => counts.find((c) => c.status === k)?.n

  return (
    <>
      <PageHeader eyebrow="Operațiuni" title="Rețete">
        <p className="mt-2 max-w-2xl text-[14.5px] text-graphite">Fiecare rețetă este verificată de optometrist înainte ca lentilele să intre în laborator. Datele sunt criptate; fiecare deschidere se înregistrează în jurnalul de audit.</p>
      </PageHeader>

      <nav aria-label="Filtru status" className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/retete?status=${t.key}`} aria-current={t.key === tab ? 'page' : undefined} className="tab-pill">
            {t.label}{count(t.key) ? <span className="ml-1.5 font-mono text-[12px] tnum">{count(t.key)}</span> : null}
          </Link>
        ))}
      </nav>

      {!canVerify && tab === 'pending' ? <p className="mb-6 rounded-2xl bg-warn-50 p-4 text-[14px] text-warn">Poți vedea coada, dar doar un optometrist sau un manager poate valida rețetele.</p> : null}

      {rows.length === 0 ? (
        <Panel><Empty icon="check" title={tab === 'pending' ? 'Coada e goală' : 'Nimic aici'}>{tab === 'pending' ? 'Toate rețetele primite au fost verificate.' : undefined}</Empty></Panel>
      ) : (
        <div className="grid gap-5 2xl:grid-cols-2">
          {rows.map(({ rx: p, orderId, number, customer, lensType, product, account }) => {
            const values = p.dataEnc ? decryptJson<RxValues>(p.dataEnc) : null
            const issues = values ? validateRx(values, { requiresAdd: lensType === 'progressive' }) : []
            return (
              <Panel key={p.id + (orderId ?? '')}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-bold">{customer ?? account ?? 'Rețetă salvată în cont'}</div>
                    <div className="spec">
                      {number ? <Link href={`/admin/comenzi/${orderId}`} className="text-cobalt">{number}</Link> : 'fără comandă'}
                      {product ? ` · ${product}` : ''}
                      {lensType ? ` · ${lensType === 'progressive' ? 'progresive' : lensType === 'office' ? 'office' : 'monofocale'}` : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge tone={p.source === 'upload' ? 'info' : 'neutral'}>{p.source === 'upload' ? 'poză / PDF' : p.source === 'manual' ? 'completată manual' : p.source}</Badge>
                    <div className="spec mt-1">{formatDateTime(p.createdAt)}</div>
                  </div>
                </div>

                {values ? (
                  <table className="mt-4 w-full max-w-lg font-mono text-[14px] tnum">
                    <thead><tr className="text-left text-[11px] uppercase tracking-[0.08em] text-graphite"><th className="w-10 font-normal" /><th className="font-normal">SPH</th><th className="font-normal">CYL</th><th className="font-normal">AX</th><th className="font-normal">ADD</th></tr></thead>
                    <tbody>
                      {(['od', 'os'] as const).map((e) => (
                        <tr key={e} className="border-t border-line-soft"><td className="py-1.5 text-graphite">{e.toUpperCase()}</td><td>{formatDiopter(values[e].sph)}</td><td>{formatDiopter(values[e].cyl)}</td><td>{values[e].axis ?? '—'}</td><td>{values[e].add ? formatDiopter(values[e].add) : '—'}</td></tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
                {values ? <p className="mt-2 text-[13.5px]">PD {values.pd.mode === 'single' ? `${values.pd.value} mm` : values.pd.mode === 'dual' ? `${values.pd.right} / ${values.pd.left} mm` : <strong className="text-warn">necunoscut — se măsoară la telefon / în showroom</strong>}</p> : null}
                {issues.length ? (
                  <ul className="mt-3 flex flex-col gap-1 text-[13px]">
                    {issues.map((i) => <li key={i.field + i.message} className={i.level === 'error' ? 'text-err' : 'text-warn'}><Icon name="alert" size={14} className="mr-1 inline" />{i.message}</li>)}
                  </ul>
                ) : null}
                {p.fileKey ? (
                  <a href={`/api/private/rx/${p.id}`} target="_blank" className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-cobalt-50 px-3 py-2 text-[13.5px] font-bold text-cobalt no-underline">
                    <Icon name="file" size={16} /> Deschide fișierul încărcat
                  </a>
                ) : null}
                {p.reviewNote ? <p className="mt-3 rounded-xl bg-fog p-3 text-[13.5px]">Notă: {p.reviewNote}</p> : null}

                {canVerify && (tab === 'pending' || tab === 'needs_info') ? (
                  <div className="mt-4 border-t border-line-soft pt-4">
                    <AdminForm action={reviewPrescription.bind(null, p.id)} submit="Salvează">
                      <div className="grid gap-3 sm:grid-cols-[190px_1fr]">
                        <Field label="Rezultat">
                          <select name="status" defaultValue="verified" className={input}>
                            <option value="verified">Verificată — OK</option>
                            <option value="needs_info">Cer clarificări</option>
                            <option value="rejected">Respinsă</option>
                          </select>
                        </Field>
                        <Field label="Notă pentru client"><input name="note" className={input} placeholder="ex. Vă rugăm o poză în care se vede și axul OS" /></Field>
                      </div>
                    </AdminForm>
                  </div>
                ) : null}
              </Panel>
            )
          })}
        </div>
      )}
    </>
  )
}
