'use server'

import { eq } from 'drizzle-orm'
import { refresh, revalidateTag } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { order, orderEvent, prescription } from '@/lib/db/schema'
import { TRANSITIONS, type OrderStatus } from '@/lib/order-status'
import { audit } from '@/server/audit'
import { OrderError, transitionOrder } from '@/server/orders'
import { InvoiceError, issueInvoice, issueInvoiceSafely } from '@/server/invoicing'
import { requireStaff } from '@/server/session'

type R = { ok: boolean; message?: string; error?: string }

export async function changeOrderStatus(orderId: string, to: OrderStatus, message?: string): Promise<R> {
  const me = await requireStaff('orders:write')
  const o = await db.query.order.findFirst({ where: eq(order.id, orderId) })
  if (!o) return { ok: false, error: 'Comanda nu există.' }
  if (!TRANSITIONS[o.status].includes(to)) return { ok: false, error: `Tranziție nepermisă: ${o.status} → ${to}` }
  if (to === 'in_lab' && o.requiresRx) {
    const items = await db.query.orderItem.findMany({ where: (t, { eq: e }) => e(t.orderId, o.id), with: { prescription: true } })
    const unverified = items.filter((i) => i.configuration && !['none', 'plano'].includes(i.configuration.lensType) && i.prescription?.status !== 'verified')
    if (unverified.length) return { ok: false, error: 'Rețeta trebuie verificată de optometrist înainte de laborator.' }
  }
  try {
    await transitionOrder(o.id, to, { actor: { id: me.id, name: me.name }, message })
  } catch (e) {
    return { ok: false, error: e instanceof OrderError ? e.message : 'Eroare la actualizare.' }
  }
  await audit(me, 'order.status', 'order', o.id, { from: o.status, to })
  refresh()
  return { ok: true, message: 'Status actualizat.' }
}

export async function shipOrder(orderId: string, _: unknown, formData: FormData): Promise<R> {
  const me = await requireStaff('orders:write')
  const awb = String(formData.get('awb') ?? '').trim()
  const carrier = String(formData.get('carrier') ?? 'Sameday').trim()
  if (!awb) return { ok: false, error: 'Completează AWB-ul.' }
  const o = await db.query.order.findFirst({ where: eq(order.id, orderId) })
  if (!o) return { ok: false, error: 'Comanda nu există.' }
  const trackingUrl = carrier.toLowerCase().includes('fan') ? `https://www.fancourier.ro/awb-tracking/?tracking=${encodeURIComponent(awb)}` : carrier.toLowerCase().includes('cargus') ? `https://www.cargus.ro/personal/urmareste-coletul/?tracking_number=${encodeURIComponent(awb)}` : `https://sameday.ro/#awb=${encodeURIComponent(awb)}`
  await db.update(order).set({ trackingUrl }).where(eq(order.id, o.id))
  try {
    await transitionOrder(o.id, 'shipped', { actor: { id: me.id, name: me.name }, awb, carrier, message: `Expediată cu ${carrier}, AWB ${awb}` })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Eroare.' }
  }
  await audit(me, 'order.ship', 'order', o.id, { awb, carrier })
  refresh()
  return { ok: true, message: 'Marcată ca expediată. Clientul a primit e-mail.' }
}

const noteSchema = z.object({ note: z.string().trim().min(1).max(2000), public: z.string().optional() })

export async function addOrderNote(orderId: string, _: unknown, formData: FormData): Promise<R> {
  const me = await requireStaff('orders:write')
  const d = noteSchema.safeParse(Object.fromEntries(formData))
  if (!d.success) return { ok: false, error: 'Scrie o notă.' }
  await db.insert(orderEvent).values({ orderId, kind: 'note', message: d.data.note, public: d.data.public === 'on', actorId: me.id, actorName: me.name })
  refresh()
  return { ok: true, message: 'Notă adăugată.' }
}

export async function markPaid(orderId: string): Promise<R> {
  const me = await requireStaff('orders:write')
  await db.update(order).set({ paymentStatus: 'paid', paidAt: new Date() }).where(eq(order.id, orderId))
  await db.insert(orderEvent).values({ orderId, kind: 'payment', message: 'Plată înregistrată manual', public: true, actorId: me.id, actorName: me.name })
  await audit(me, 'order.paid', 'order', orderId)
  after(() => issueInvoiceSafely(orderId))
  refresh()
  return { ok: true, message: 'Plată marcată.' }
}

export async function createInvoice(orderId: string): Promise<R> {
  const me = await requireStaff('orders:write')
  try {
    const inv = await issueInvoice(orderId)
    await audit(me, 'order.invoice', 'order', orderId, inv)
    refresh()
    return { ok: true, message: `Factura ${inv.series}${inv.number} emisă.` }
  } catch (e) {
    return { ok: false, error: e instanceof InvoiceError ? e.message : 'Factura nu a putut fi emisă.' }
  }
}

const rxSchema = z.object({ status: z.enum(['verified', 'needs_info', 'rejected']), note: z.string().trim().max(1000).optional() })

export async function reviewPrescription(prescriptionId: string, _: unknown, formData: FormData): Promise<R> {
  const me = await requireStaff('rx:verify')
  const d = rxSchema.safeParse(Object.fromEntries(formData))
  if (!d.success) return { ok: false, error: 'Alege rezultatul verificării.' }
  await db.update(prescription).set({ status: d.data.status, reviewNote: d.data.note ?? null, verifiedById: me.id, verifiedAt: new Date() }).where(eq(prescription.id, prescriptionId))
  await audit(me, `rx.${d.data.status}`, 'prescription', prescriptionId, { note: d.data.note })
  // move linked orders forward / on hold
  const items = await db.query.orderItem.findMany({ where: (t, { eq: e }) => e(t.prescriptionId, prescriptionId), with: { order: true } })
  for (const it of items) {
    if (d.data.status === 'needs_info' && ['placed', 'rx_review'].includes(it.order.status)) await transitionOrder(it.order.id, 'on_hold', { actor: { id: me.id, name: me.name }, message: d.data.note || 'Avem nevoie de clarificări despre rețetă.' })
    if (d.data.status === 'verified') await db.insert(orderEvent).values({ orderId: it.order.id, kind: 'rx', message: 'Rețetă verificată de optometrist', public: true, actorId: me.id, actorName: me.name })
  }
  revalidateTag('rx', { expire: 0 })
  refresh()
  return { ok: true, message: 'Verificare salvată.' }
}

export async function saveInternalNote(orderId: string, _: unknown, formData: FormData): Promise<R> {
  const me = await requireStaff('orders:write')
  await db.update(order).set({ internalNote: String(formData.get('internalNote') ?? '').slice(0, 4000) }).where(eq(order.id, orderId))
  await audit(me, 'order.internal_note', 'order', orderId)
  refresh()
  return { ok: true, message: 'Salvat.' }
}
