import { and, desc, gte, inArray, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { order } from '@/lib/db/schema'
import { PAYMENT_LABEL, SHIPPING_LABEL, STATUS } from '@/lib/order-status'
import { audit } from '@/server/audit'
import { can, getCurrentUser } from '@/server/session'

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user || !can(user.role, 'reports:read')) return new Response('Forbidden', { status: 403 })
  const url = new URL(req.url)
  const from = url.searchParams.get('de') ? new Date(url.searchParams.get('de')!) : new Date(Date.now() - 90 * 86400000)
  const to = url.searchParams.get('pana') ? new Date(url.searchParams.get('pana')!) : new Date()
  const statuses = url.searchParams.getAll('status').filter((s) => s in STATUS) as (keyof typeof STATUS)[]
  const rows = await db.select().from(order).where(and(gte(order.createdAt, from), lt(order.createdAt, to), statuses.length ? inArray(order.status, statuses) : undefined)).orderBy(desc(order.createdAt))
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = ['Număr', 'Data', 'Canal', 'Client', 'E-mail', 'Telefon', 'Status', 'Plată', 'Status plată', 'Livrare', 'Localitate', 'Subtotal', 'Reducere', 'Transport', 'TVA', 'Total', 'AWB', 'Factură']
  const lines = [head.map(esc).join(';')]
  for (const o of rows)
    lines.push([o.number, o.createdAt.toISOString(), o.channel, o.customerName, o.email, o.phone, STATUS[o.status].label, PAYMENT_LABEL[o.paymentMethod], o.paymentStatus, SHIPPING_LABEL[o.shippingMethod], o.shippingAddress?.city ?? '', (o.subtotal / 100).toFixed(2), (o.discountTotal / 100).toFixed(2), (o.shippingTotal / 100).toFixed(2), (o.vatTotal / 100).toFixed(2), (o.total / 100).toFixed(2), o.awb ?? '', o.invoiceNumber ? `${o.invoiceSeries ?? ''}${o.invoiceNumber}` : ''].map(esc).join(';'))
  await audit(user, 'orders.export', 'order', null, { count: rows.length })
  return new Response('﻿' + lines.join('\r\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="comenzi-${new Date().toISOString().slice(0, 10)}.csv"`, 'cache-control': 'no-store' } })
}
