import 'server-only'
import { and, eq, ne, sql } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import { after } from 'next/server'
import { db } from '@/lib/db'
import { cart, cartItem, coupon, order, orderEvent, orderItem, prescription, type PostalAddress } from '@/lib/db/schema'
import { randomToken } from '@/lib/crypto'
import { formatPrice } from '@/lib/format'
import { STATUS, SHIPPING_LABEL, PAYMENT_LABEL, type OrderStatus } from '@/lib/order-status'
import type { ShippingChoice } from '@/lib/pricing'
import { loadCart } from './cart'
import { consumeOrder, releaseOrder, reserveLine } from './inventory'
import { sendMail, staffInbox } from './mail'
import { emailButton, emailLayout, orderConfirmationEmail } from './mail-templates'
import { issueInvoiceSafely } from './invoicing'
import { getSettings } from './settings'

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

export type PlaceOrderInput = {
  email: string
  phone: string
  customerName: string
  shippingMethod: ShippingChoice
  shippingAddress: PostalAddress | null
  billingAddress: PostalAddress | null
  paymentMethod: 'card' | 'cod' | 'transfer' | 'store'
  customerNote?: string
  marketingConsent: boolean
  userId: string | null
}

export class OrderError extends Error {}

export async function placeOrder(input: PlaceOrderInput) {
  const settings = await getSettings()
  const view = await loadCart({ shippingMethod: input.shippingMethod, paymentMethod: input.paymentMethod })
  if (!view.id || !view.lines.length) throw new OrderError('Coșul este gol.')
  if (view.problems.length) throw new OrderError(view.problems[0]!)
  const t = view.totals
  if (input.paymentMethod === 'cod' && t.total > settings.payments.cod.maxTotal) throw new OrderError(`Plata ramburs este disponibilă până la ${formatPrice(settings.payments.cod.maxTotal)}.`)
  if (input.paymentMethod === 'store' && input.shippingMethod !== 'pickup') throw new OrderError('Plata în showroom este disponibilă doar la ridicare.')
  const requiresRx = view.lines.some((l) => l.configuration.lensType !== 'none' && l.configuration.lensType !== 'plano')
  const rxPending = view.lines.some((l) => l.configuration.rxMode === 'later')

  const created = await db.transaction(async (tx) => {
    const seq = await tx.execute<{ n: number }>(sql`select nextval('order_number_seq')::int as n`)
    const number = `SV-${new Date().getFullYear()}-${String(seq[0]!.n).padStart(6, '0')}`
    const accessToken = randomToken(18)
    const status: OrderStatus = input.paymentMethod === 'card' ? 'pending_payment' : requiresRx ? 'rx_review' : 'placed'
    const [o] = await tx
      .insert(order)
      .values({
        number,
        accessToken,
        channel: 'b2c',
        userId: input.userId,
        email: input.email,
        phone: input.phone,
        customerName: input.customerName,
        status,
        paymentStatus: 'pending',
        paymentMethod: input.paymentMethod,
        shippingMethod: input.shippingMethod,
        shippingAddress: input.shippingAddress,
        billingAddress: input.billingAddress ?? input.shippingAddress,
        subtotal: t.subtotal,
        discountTotal: t.discount,
        shippingTotal: t.shipping + t.codFee,
        vatTotal: t.vat,
        total: t.total,
        couponCode: t.couponApplied ?? null,
        customerNote: input.customerNote || null,
        requiresRx,
        marketingConsent: input.marketingConsent,
        placedAt: new Date(),
      })
      .returning()
    for (const l of view.lines) {
      const loc = await reserveLine(tx, l.variant.id, l.quantity, input.shippingMethod === 'pickup')
      if (!loc) throw new OrderError(`${l.product.name} (${l.variant.colorName}) tocmai s-a epuizat. Scoate-o din coș sau alege altă culoare.`)
      await tx.insert(orderItem).values({
        orderId: o!.id,
        variantId: l.variant.id,
        productId: l.product.id,
        productName: l.product.name,
        variantName: l.variant.colorName,
        sku: l.variant.sku,
        quantity: l.quantity,
        unitPrice: l.priced.unitPrice,
        lineTotal: l.priced.unitPrice * l.quantity,
        vatRate: settings.vat[l.product.vatClass],
        configuration: l.configuration,
        priceBreakdown: l.priced.lines,
        prescriptionId: l.configuration.prescriptionId ?? null,
        stockLocationId: loc,
        frameSnapshot: { lensWidth: l.product.lensWidth, bridgeWidth: l.product.bridgeWidth, templeLength: l.product.templeLength, lensHeight: l.product.lensHeight, shape: l.product.shape },
      })
      if (l.configuration.prescriptionId && input.userId) {
        await tx.update(prescription).set({ userId: input.userId }).where(and(eq(prescription.id, l.configuration.prescriptionId), sql`${prescription.userId} is null`))
      }
    }
    if (t.couponApplied) await tx.update(coupon).set({ usedCount: sql`${coupon.usedCount} + 1` }).where(eq(coupon.code, t.couponApplied))
    await tx.insert(orderEvent).values({ orderId: o!.id, kind: 'status', toStatus: status, message: 'Comandă plasată online', public: true })
    await tx.delete(cartItem).where(eq(cartItem.cartId, view.id!))
    await tx.update(cart).set({ couponCode: null }).where(eq(cart.id, view.id!))
    return o!
  })

  revalidateTag('stock', { expire: 0 })
  revalidateTag('products', 'max')

  if (input.paymentMethod !== 'card') {
    after(() => sendOrderEmails(created.id))
  }
  return { order: created, lines: view.lines, rxPending }
}

export async function sendOrderEmails(orderId: string) {
  const o = await db.query.order.findFirst({ where: eq(order.id, orderId), with: { items: true } })
  if (!o) return
  const settings = await getSettings()
  const trackUrl = `${SITE}/comanda/${o.number}?t=${o.accessToken}`
  await sendMail({
    to: o.email,
    subject: `Comanda ${o.number} a fost înregistrată`,
    html: orderConfirmationEmail({
      number: o.number,
      customerName: o.customerName,
      items: o.items.map((i) => ({ name: `${i.productName} · ${i.variantName}`, detail: i.priceBreakdown.filter((x) => x.code !== 'frame').map((x) => x.label).join(', ') || 'Doar rama', amount: i.lineTotal })),
      subtotal: o.subtotal,
      discount: o.discountTotal,
      shipping: o.shippingTotal,
      total: o.total,
      paymentMethod: o.paymentMethod,
      shippingLabel: SHIPPING_LABEL[o.shippingMethod] ?? 'Livrare',
      trackUrl,
      requiresRx: o.requiresRx,
      rxPending: o.items.some((i) => i.configuration?.rxMode === 'later'),
      bankDetails: { iban: settings.company.iban, bank: settings.company.bank, legalName: settings.company.legalName },
    }),
  })
  const staff = staffInbox()
  if (staff) {
    await sendMail({
      to: staff,
      subject: `Comandă nouă ${o.number} · ${formatPrice(o.total)}${o.requiresRx ? ' · cu rețetă' : ''}`,
      html: emailLayout({
        preheader: `${o.customerName} · ${PAYMENT_LABEL[o.paymentMethod]}`,
        title: `Comandă nouă ${o.number}`,
        body: `<p>${o.customerName} · ${o.email} · ${o.phone}</p><p>${o.items.map((i) => `${i.quantity}× ${i.productName} (${i.variantName})`).join('<br>')}</p><p><strong>${formatPrice(o.total)}</strong> · ${PAYMENT_LABEL[o.paymentMethod]} · ${SHIPPING_LABEL[o.shippingMethod]}</p>${emailButton(`${SITE}/admin/comenzi/${o.id}`, 'Deschide în admin')}`,
      }),
    })
  }
}

/** Status change with side effects (stock, timestamps, customer e-mail). Used by admin & payment webhooks. */
export async function transitionOrder(orderId: string, to: OrderStatus, opts: { actor?: { id: string; name: string } | null; message?: string; notify?: boolean; awb?: string; carrier?: string } = {}) {
  const o = await db.query.order.findFirst({ where: eq(order.id, orderId) })
  if (!o) throw new OrderError('Comanda nu există.')
  if (o.status === to) return o
  const now = new Date()
  await db.transaction(async (tx) => {
    const patch: Partial<typeof order.$inferInsert> = { status: to }
    if (to === 'cancelled') {
      patch.cancelledAt = now
      await releaseOrder(tx, o.id)
    }
    if ((to === 'shipped' || (to === 'delivered' && o.shippingMethod === 'pickup')) && !o.shippedAt) {
      patch.shippedAt = now
      await consumeOrder(tx, o.id, o.number, opts.actor?.id)
    }
    if (to === 'delivered') {
      patch.deliveredAt = now
      if (o.paymentMethod === 'cod' || o.paymentMethod === 'store') {
        patch.paymentStatus = 'paid'
        patch.paidAt = o.paidAt ?? now
      }
    }
    if (opts.awb) patch.awb = opts.awb
    if (opts.carrier) patch.carrier = opts.carrier
    await tx.update(order).set(patch).where(eq(order.id, o.id))
    await tx.insert(orderEvent).values({ orderId: o.id, kind: 'status', fromStatus: o.status, toStatus: to, message: opts.message ?? STATUS[to].customer, public: true, actorId: opts.actor?.id, actorName: opts.actor?.name })
  })
  revalidateTag('stock', { expire: 0 })
  if (opts.notify !== false && ['on_hold', 'ready', 'shipped', 'cancelled'].includes(to)) {
    after(() => notifyStatus(o.id))
  }
  // cash on delivery / in store: the invoice is issued once the money is collected
  if (to === 'delivered' && o.paymentStatus !== 'paid' && (o.paymentMethod === 'cod' || o.paymentMethod === 'store')) after(() => issueInvoiceSafely(o.id))
  return o
}

async function notifyStatus(orderId: string) {
  const o = await db.query.order.findFirst({ where: eq(order.id, orderId) })
  if (!o) return
  const settings = await getSettings()
  const trackUrl = `${SITE}/comanda/${o.number}?t=${o.accessToken}`
  const copy: Partial<Record<OrderStatus, { subject: string; body: string }>> = {
    on_hold: { subject: `Avem nevoie de un detaliu pentru comanda ${o.number}`, body: '<p>Optometristul nostru are o întrebare despre rețetă sau măsurători. Te sunăm în curând — sau ne poți scrie direct ca răspuns la acest e-mail.</p>' },
    ready:
      o.shippingMethod === 'pickup'
        ? { subject: `Ochelarii tăi sunt gata de ridicare — ${o.number}`, body: `<p>Te așteptăm în showroom, pe ${settings.company.address}, ${settings.company.city}. Îi ajustăm pe fața ta la ridicare.</p>` }
        : { subject: `Comanda ${o.number} e gata de expediere`, body: '<p>Am terminat montajul și controlul de calitate. Îți trimitem numărul AWB imediat ce coletul pleacă.</p>' },
    shipped: { subject: `Comanda ${o.number} a fost expediată`, body: `<p>Coletul e pe drum${o.awb ? `, AWB <strong>${o.awb}</strong>` : ''}. De obicei ajunge în 1–2 zile lucrătoare.</p>` },
    cancelled: { subject: `Comanda ${o.number} a fost anulată`, body: '<p>Comanda a fost anulată. Dacă ai plătit online, suma îți este returnată în 3–10 zile lucrătoare, în funcție de bancă.</p>' },
  }
  const c = copy[o.status]
  if (!c) return
  await sendMail({ to: o.email, subject: c.subject, html: emailLayout({ preheader: STATUS[o.status].customer, title: STATUS[o.status].customer, body: `${c.body}${emailButton(trackUrl, 'Vezi comanda')}` }) })
}

/** Payment confirmed (webhook / simulator). Idempotent. */
export async function markOrderPaid(orderNumber: string, ref: string | null, provider: string) {
  const o = await db.query.order.findFirst({ where: eq(order.number, orderNumber) })
  if (!o || o.paymentStatus === 'paid') return o
  const next: OrderStatus = o.status === 'pending_payment' ? (o.requiresRx ? 'rx_review' : 'placed') : o.status
  // conditional update: the IPN and the browser return can race — only one wins
  const won = await db
    .update(order)
    .set({ paymentStatus: 'paid', paidAt: new Date(), paymentRef: ref ?? o.paymentRef, paymentProvider: provider, status: next })
    .where(and(eq(order.id, o.id), ne(order.paymentStatus, 'paid')))
    .returning({ id: order.id })
  if (!won.length) return o
  if (o.status === 'cancelled') {
    // paid after the payment window expired (stock already released) → a human decides: refund or reactivate
    await db.insert(orderEvent).values({ orderId: o.id, kind: 'payment', message: `Plată primită după expirarea comenzii (${provider}) — verifică stocul și reactivează sau rambursează.`, public: false })
    const staff = staffInbox()
    if (staff) after(() => sendMail({ to: staff, subject: `Plată întârziată pe comanda anulată ${o.number}`, html: emailLayout({ preheader: o.customerName, title: `Plată pe comanda anulată ${o.number}`, body: `<p>${o.customerName} a plătit după expirarea ferestrei de plată. Stocul a fost eliberat — reactivează comanda sau rambursează plata.</p>` }) }))
    return o
  }
  await db.insert(orderEvent).values({ orderId: o.id, kind: 'payment', fromStatus: o.status, toStatus: next, message: `Plată confirmată (${provider})`, public: true })
  after(async () => {
    await sendOrderEmails(o.id)
    await issueInvoiceSafely(o.id)
  })
  return o
}

export async function markOrderPaymentFailed(orderNumber: string, reason: string) {
  const o = await db.query.order.findFirst({ where: eq(order.number, orderNumber) })
  if (!o || o.paymentStatus === 'paid') return o
  await db.update(order).set({ paymentStatus: 'failed' }).where(eq(order.id, o.id))
  await db.insert(orderEvent).values({ orderId: o.id, kind: 'payment', message: `Plata nu a reușit: ${reason}`, public: true })
  return o
}
