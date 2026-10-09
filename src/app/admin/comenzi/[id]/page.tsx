import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { addOrderNote, changeOrderStatus, createInvoice, markPaid, reviewPrescription, saveInternalNote, shipOrder } from '@/app/admin/_actions/orders'
import { ActionButton } from '@/components/admin/action-button'
import { AdminForm } from '@/components/admin/form'
import { Badge, Field, input, PageHeader, Panel } from '@/components/admin/ui'
import { Icon } from '@/components/icons'
import { db } from '@/lib/db'
import { order } from '@/lib/db/schema'
import { decryptJson } from '@/lib/crypto'
import { formatDateTime, formatPrice } from '@/lib/format'
import { formatDiopter, type RxValues } from '@/lib/optics'
import { PAYMENT_LABEL, PAYMENT_STATUS_LABEL, SHIPPING_LABEL, STATUS, TRANSITIONS } from '@/lib/order-status'
import { formatPhone } from '@/lib/ro'
import { audit } from '@/server/audit'
import { invoicingEnabled } from '@/server/invoicing'
import { can, requireStaff } from '@/server/session'

export const metadata = { title: 'Comandă' }

export default function OrderDetail({ params }: Pick<PageProps<'/admin/comenzi/[id]'>, 'params'>) {
  return (
    <Suspense fallback={<div className="skeleton h-[600px]" />}>
      <Detail params={params} />
    </Suspense>
  )
}

const pdText = (pd: RxValues['pd']) => (pd.mode === 'single' ? `${pd.value} mm` : pd.mode === 'dual' ? `${pd.right} / ${pd.left} mm` : 'necunoscut — de sunat')

async function Detail({ params }: Pick<PageProps<'/admin/comenzi/[id]'>, 'params'>) {
  const me = await requireStaff('orders:read')
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const o = await db.query.order.findFirst({
    where: eq(order.id, id),
    with: { items: { with: { prescription: true } }, events: true, partner: true },
  })
  if (!o) notFound()
  const canRx = can(me.role, 'rx:verify')
  const hasRx = o.items.some((i) => i.prescription)
  if (hasRx) await audit(me, 'rx.view', 'order', o.id)
  const next = TRANSITIONS[o.status]
  const events = [...o.events].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  const addr = o.shippingAddress
  const bill = o.billingAddress

  return (
    <>
      <PageHeader
        eyebrow={`${o.channel === 'b2b' ? 'Comandă B2B' : 'Comandă online'} · ${formatDateTime(o.createdAt)}`}
        title={o.number}
        actions={
          <>
            <Link href={`/admin/comenzi/${o.id}/fisa`} target="_blank" className="btn btn-secondary btn-sm"><Icon name="print" size={16} /> Fișă laborator</Link>
            <Link href={`/comanda/${o.number}?t=${o.accessToken}`} target="_blank" className="btn btn-ghost btn-sm"><Icon name="external" size={16} /> Vedere client</Link>
          </>
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={STATUS[o.status].tone}>{STATUS[o.status].label}</Badge>
          <Badge tone={o.paymentStatus === 'paid' ? 'ok' : o.paymentStatus === 'failed' ? 'err' : 'warn'}>{PAYMENT_LABEL[o.paymentMethod]} · {PAYMENT_STATUS_LABEL[o.paymentStatus]}</Badge>
          <Badge>{SHIPPING_LABEL[o.shippingMethod]}</Badge>
        </div>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-6">
          <Panel title="Flux">
            <div className="flex flex-wrap gap-2">
              {next.length ? next.map((s) => (
                <ActionButton key={s} action={changeOrderStatus.bind(null, o.id, s, undefined)} variant={s === 'cancelled' ? 'danger' : s === next[0] ? 'primary' : 'secondary'} confirm={s === 'cancelled' ? 'Anulezi comanda? Stocul rezervat se eliberează și clientul primește e-mail.' : undefined}>
                  → {STATUS[s].label}
                </ActionButton>
              )) : <span className="text-[14px] text-graphite">Comanda este închisă.</span>}
              {o.paymentStatus !== 'paid' && o.status !== 'cancelled' ? <ActionButton action={markPaid.bind(null, o.id)} variant="ghost">Marchează încasată</ActionButton> : null}
            </div>
            {['ready', 'qc', 'in_lab'].includes(o.status) && o.shippingMethod !== 'pickup' ? (
              <div className="mt-5 border-t border-line-soft pt-5">
                <AdminForm action={shipOrder.bind(null, o.id)} submit="Expediază & anunță clientul">
                  <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                    <Field label="AWB"><input name="awb" defaultValue={o.awb ?? ''} className={input} placeholder="ex. 4EMGLN…" /></Field>
                    <Field label="Curier">
                      <select name="carrier" defaultValue={o.carrier ?? 'Sameday'} className={input}><option>Sameday</option><option>FAN Courier</option><option>Cargus</option><option>DPD</option></select>
                    </Field>
                  </div>
                </AdminForm>
              </div>
            ) : null}
          </Panel>

          <Panel title={`Produse · ${o.items.length}`} pad={false}>
            <ul className="divide-y divide-line-soft">
              {o.items.map((it) => {
                const rx = it.prescription?.dataEnc ? decryptJson<RxValues>(it.prescription.dataEnc) : null
                return (
                  <li key={it.id} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-bold">{it.quantity > 1 ? `${it.quantity}× ` : ''}{it.productName} · {it.variantName}</div>
                        <div className="spec">{it.sku}{it.frameSnapshot ? ` · ${it.frameSnapshot.lensWidth}□${it.frameSnapshot.bridgeWidth} ${it.frameSnapshot.templeLength} · B ${it.frameSnapshot.lensHeight}` : ''}</div>
                      </div>
                      <div className="font-bold tnum">{formatPrice(it.lineTotal)}</div>
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-graphite">
                      {it.priceBreakdown.map((l) => <li key={l.code}>{l.code === 'frame' ? 'Rama' : l.label} <span className="tnum">{l.amount ? formatPrice(l.amount) : 'inclus'}</span></li>)}
                    </ul>
                    {it.configuration?.notes ? <p className="mt-2 rounded-lg bg-warn-50 px-3 py-2 text-[13px] text-warn">Notă client: {it.configuration.notes}</p> : null}
                    {it.configuration && !['none', 'plano'].includes(it.configuration.lensType) ? (
                      <div className="mt-4 rounded-2xl bg-paper p-4 ring-1 ring-line-soft">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-2 text-[14px] font-bold"><Icon name="rx" size={18} /> Rețetă {it.prescription ? `· ${it.prescription.source === 'upload' ? 'poză încărcată' : 'completată'}` : '· lipsește'}</span>
                          {it.prescription ? <Badge tone={it.prescription.status === 'verified' ? 'ok' : it.prescription.status === 'pending' ? 'warn' : 'err'}>{it.prescription.status === 'verified' ? 'verificată' : it.prescription.status === 'pending' ? 'de verificat' : it.prescription.status === 'needs_info' ? 'clarificări' : 'respinsă'}</Badge> : <Badge tone="warn">clientul o trimite</Badge>}
                        </div>
                        {rx ? (
                          <table className="mt-3 w-full max-w-md font-mono text-[13.5px] tnum">
                            <thead><tr className="text-left text-graphite"><th className="font-normal" /><th className="font-normal">SPH</th><th className="font-normal">CYL</th><th className="font-normal">AX</th><th className="font-normal">ADD</th></tr></thead>
                            <tbody>
                              {(['od', 'os'] as const).map((e) => (
                                <tr key={e}><td className="pr-3 text-graphite">{e.toUpperCase()}</td><td>{formatDiopter(rx[e].sph)}</td><td>{formatDiopter(rx[e].cyl)}</td><td>{rx[e].axis ?? '—'}</td><td>{rx[e].add ? formatDiopter(rx[e].add) : '—'}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        ) : null}
                        {rx ? <p className="mt-2 text-[13px]">PD: <strong>{pdText(rx.pd)}</strong>{rx.notes ? ` · ${rx.notes}` : ''}</p> : null}
                        {it.prescription?.fileKey ? <a href={`/api/private/rx/${it.prescription.id}`} target="_blank" className="mt-2 inline-flex items-center gap-1.5 text-[13.5px] font-bold text-cobalt"><Icon name="file" size={16} /> Deschide fișierul rețetei</a> : null}
                        {it.prescription && canRx ? (
                          <div className="mt-4 border-t border-line-soft pt-4">
                            <AdminForm action={reviewPrescription.bind(null, it.prescription.id)} submit="Salvează verificarea">
                              <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
                                <Field label="Rezultat">
                                  <select name="status" defaultValue={it.prescription.status === 'pending' ? 'verified' : it.prescription.status} className={input}>
                                    <option value="verified">Verificată — OK</option>
                                    <option value="needs_info">Necesită clarificări</option>
                                    <option value="rejected">Respinsă</option>
                                  </select>
                                </Field>
                                <Field label="Notă (vizibilă clientului la clarificări)"><input name="note" defaultValue={it.prescription.reviewNote ?? ''} className={input} /></Field>
                              </div>
                            </AdminForm>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
            <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 border-t border-line-soft p-5 text-[14px]">
              <dt>Subtotal{o.channel === 'b2b' ? ' (net)' : ''}</dt><dd className="text-right tnum">{formatPrice(o.subtotal)}</dd>
              {o.discountTotal ? <><dt>Reducere {o.couponCode}</dt><dd className="text-right text-ok tnum">−{formatPrice(o.discountTotal)}</dd></> : null}
              <dt>Transport</dt><dd className="text-right tnum">{formatPrice(o.shippingTotal)}</dd>
              <dt className="text-graphite">din care TVA</dt><dd className="text-right text-graphite tnum">{formatPrice(o.vatTotal)}</dd>
              <dt className="font-bold">Total</dt><dd className="text-right text-[18px] font-bold tnum">{formatPrice(o.total)}</dd>
            </dl>
          </Panel>

          <Panel title="Istoric">
            <AdminForm action={addOrderNote.bind(null, o.id)} submit="Adaugă notă">
              <div className="flex flex-col gap-2">
                <textarea name="note" rows={2} className="field h-auto py-2.5 text-[14px]" placeholder="Notă despre comandă…" aria-label="Notă" />
                <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="public" className="accent-cobalt" /> Vizibilă clientului pe pagina comenzii</label>
              </div>
            </AdminForm>
            <ol className="mt-6 flex flex-col gap-4 border-l border-line pl-5">
              {events.map((e) => (
                <li key={e.id} className="relative text-[14px]">
                  <span className={`absolute -left-[25px] top-1.5 size-2.5 rounded-full ring-4 ring-glass ${e.kind === 'note' ? 'bg-mist' : 'bg-ink'}`} />
                  <div>{e.message}{e.public ? '' : <span className="ml-2 text-[12px] text-graphite">(intern)</span>}</div>
                  <div className="spec">{formatDateTime(e.createdAt)}{e.actorName ? ` · ${e.actorName}` : ''}</div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Client">
            <div className="text-[15px] font-bold">{o.customerName}</div>
            <a href={`mailto:${o.email}`} className="mt-1 block text-[14px] text-cobalt">{o.email}</a>
            <a href={`tel:${o.phone}`} className="block text-[14px]">{formatPhone(o.phone)}</a>
            {o.partner ? <Link href="/admin/parteneri" className="mt-2 inline-block text-[13.5px] font-bold text-cobalt">{o.partner.companyName} · {o.partner.cui}</Link> : null}
            {o.customerNote ? <p className="mt-3 rounded-xl bg-fog p-3 text-[13.5px]">„{o.customerNote}”</p> : null}
          </Panel>
          <Panel title="Livrare">
            {addr ? (
              <address className="text-[14px] not-italic leading-relaxed">
                {addr.name}<br />{addr.street}<br />{[addr.postalCode, addr.city, addr.county].filter(Boolean).join(', ')}
                {addr.lockerName ? <><br /><Badge>easybox</Badge> {addr.lockerName}</> : null}
              </address>
            ) : <p className="text-[14px]">Ridicare din showroom</p>}
            {o.awb ? <p className="mt-3 text-[14px]">AWB <a href={o.trackingUrl ?? '#'} target="_blank" className="font-mono text-cobalt">{o.awb}</a> · {o.carrier}</p> : null}
          </Panel>
          <Panel title="Facturare">
            {bill ? (
              <div className="text-[14px] leading-relaxed">
                {bill.company ? <><strong>{bill.company}</strong><br />CUI {bill.cui}{bill.regCom ? ` · ${bill.regCom}` : ''}<br /></> : null}
                {bill.name}<br />{bill.street}, {bill.city}, {bill.county}
              </div>
            ) : <p className="text-[14px] text-graphite">Ca la livrare</p>}
            {o.invoiceNumber ? (
              <p className="mt-3 text-[13.5px]">Factura <strong>{o.invoiceSeries ?? ''}{o.invoiceNumber}</strong>{o.invoiceUrl ? <> · <a href={o.invoiceUrl} target="_blank" rel="noreferrer" className="text-cobalt">PDF</a></> : null}</p>
            ) : invoicingEnabled() ? (
              <div className="mt-3"><ActionButton action={createInvoice.bind(null, o.id)} variant="secondary">Emite factura (SmartBill)</ActionButton></div>
            ) : (
              <p className="mt-3 text-[13px] text-graphite">Facturare automată neconfigurată — emite factura manual (vezi Lansare & integrări).</p>
            )}
          </Panel>
          <Panel title="Notă internă">
            <AdminForm action={saveInternalNote.bind(null, o.id)}>
              <textarea name="internalNote" rows={4} defaultValue={o.internalNote ?? ''} className="field h-auto py-2.5 text-[14px]" aria-label="Notă internă" />
            </AdminForm>
          </Panel>
          <Panel title="Plată">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13.5px]">
              <dt className="text-graphite">Metodă</dt><dd>{PAYMENT_LABEL[o.paymentMethod]}</dd>
              <dt className="text-graphite">Procesator</dt><dd>{o.paymentProvider ?? '—'}</dd>
              <dt className="text-graphite">Referință</dt><dd className="break-all font-mono text-[12px]">{o.paymentRef ?? '—'}</dd>
              <dt className="text-graphite">Încasată</dt><dd>{o.paidAt ? formatDateTime(o.paidAt) : '—'}</dd>
            </dl>
          </Panel>
        </div>
      </div>
    </>
  )
}
