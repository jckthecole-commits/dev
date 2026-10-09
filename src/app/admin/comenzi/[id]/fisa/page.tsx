import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { PrintButton } from '@/components/admin/print-button'
import { db } from '@/lib/db'
import { order } from '@/lib/db/schema'
import { decryptJson } from '@/lib/crypto'
import { formatDateTime } from '@/lib/format'
import { formatDiopter, type RxValues } from '@/lib/optics'
import { audit } from '@/server/audit'
import { requireStaff } from '@/server/session'

export const metadata = { title: 'Fișă de laborator' }

/** Printable lab work order ("fișă de montaj") — one page per pair. */
export default function LabSheet({ params }: Pick<PageProps<'/admin/comenzi/[id]/fisa'>, 'params'>) {
  return (
    <Suspense fallback={null}>
      <Sheet params={params} />
    </Suspense>
  )
}

async function Sheet({ params }: Pick<PageProps<'/admin/comenzi/[id]/fisa'>, 'params'>) {
  const me = await requireStaff('orders:read')
  const { id } = await params
  const o = await db.query.order.findFirst({ where: eq(order.id, id), with: { items: { with: { prescription: true } } } })
  if (!o) notFound()
  await audit(me, 'rx.print', 'order', o.id)
  const pairs = o.items.filter((i) => i.configuration && i.configuration.lensType !== 'none')
  return (
    <div className="mx-auto max-w-[800px] bg-white p-8 text-ink print:p-0">
      <div className="no-print mb-6 flex justify-end"><PrintButton /></div>
      {(pairs.length ? pairs : o.items).map((it, idx) => {
        const rx = it.prescription?.dataEnc ? decryptJson<RxValues>(it.prescription.dataEnc) : null
        const f = it.frameSnapshot
        return (
          <section key={it.id} className="mb-10 break-after-page border border-ink p-6">
            <header className="flex items-start justify-between border-b border-ink pb-3">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.14em]">Fișă de montaj · {idx + 1}/{Math.max(1, pairs.length)}</div>
                <div className="mt-1 text-[26px] font-bold">{o.number}</div>
              </div>
              <div className="text-right text-[13px]">
                <div>{o.customerName}</div>
                <div>{formatDateTime(o.createdAt)}</div>
              </div>
            </header>
            <div className="mt-4 grid grid-cols-2 gap-6 text-[14px]">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.1em]">Ramă</div>
                <div className="mt-1 font-bold">{it.productName} · {it.variantName}</div>
                <div className="font-mono">{it.sku}</div>
                {f ? <div className="mt-1 font-mono">A {f.lensWidth} · DBL {f.bridgeWidth} · B {f.lensHeight} · braț {f.templeLength} · {f.shape}</div> : null}
              </div>
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.1em]">Lentile</div>
                <ul className="mt-1">
                  {it.priceBreakdown.filter((l) => l.code !== 'frame').map((l) => <li key={l.code}>☐ {l.label}</li>)}
                </ul>
              </div>
            </div>
            <div className="mt-6">
              <div className="font-mono text-[11px] uppercase tracking-[0.1em]">Rețetă {it.prescription ? `(${it.prescription.status === 'verified' ? 'verificată' : 'NEVERIFICATĂ'})` : '(lipsește)'}</div>
              <table className="mt-2 w-full border-collapse font-mono text-[15px]">
                <thead><tr>{['', 'SPH', 'CYL', 'AX', 'ADD', 'PD'].map((h) => <th key={h} scope="col" className="border border-ink px-3 py-2 text-left text-[12px]">{h}</th>)}</tr></thead>
                <tbody>
                  {(['od', 'os'] as const).map((e) => (
                    <tr key={e}>
                      <td className="border border-ink px-3 py-2 font-bold">{e.toUpperCase()}</td>
                      <td className="border border-ink px-3 py-2">{rx ? formatDiopter(rx[e].sph) : ''}</td>
                      <td className="border border-ink px-3 py-2">{rx ? formatDiopter(rx[e].cyl) : ''}</td>
                      <td className="border border-ink px-3 py-2">{rx ? (rx[e].axis ?? '—') : ''}</td>
                      <td className="border border-ink px-3 py-2">{rx?.[e].add ? formatDiopter(rx[e].add) : ''}</td>
                      {rx?.pd.mode === 'single' ? (
                        e === 'od' ? <td rowSpan={2} className="border border-ink px-3 py-2 align-middle">{rx.pd.value}<div className="text-[11px]">binocular</div></td> : null
                      ) : (
                        <td className="border border-ink px-3 py-2">{rx ? (rx.pd.mode === 'dual' ? (e === 'od' ? rx.pd.right : rx.pd.left) : 'de măsurat') : ''}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {it.configuration?.notes ? <p className="mt-2 text-[13px]">Note: {it.configuration.notes}</p> : null}
            </div>
            <div className="mt-6 grid grid-cols-4 gap-3 text-[12px]">
              {['Tăiere', 'Montaj', 'Control frontofocometru', 'Ajustare & curățare'].map((s) => (
                <div key={s} className="border border-ink p-2"><div className="font-bold">{s}</div><div className="mt-6 border-t border-dotted border-ink pt-1">semnătură / dată</div></div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
