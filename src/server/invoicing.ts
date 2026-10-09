import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { order, orderEvent } from '@/lib/db/schema'
import { zonedDay } from '@/lib/time'
import { getSettings } from './settings'

/**
 * SmartBill Cloud invoicing (RO). The SmartBill account is configured to
 * forward invoices to ANAF SPV (e-Factura) — legally required within 5
 * working days for B2B and B2C invoices.
 * Docs: https://api.smartbill.ro — POST /SBORO/api/invoice, Basic auth (user:token).
 */
const API = 'https://ws.smartbill.ro/SBORO/api'

export const invoicingEnabled = () => !!(process.env.SMARTBILL_USER && process.env.SMARTBILL_TOKEN && process.env.SMARTBILL_CIF)

/** SmartBill tax names as configured in the account (overridable per install). */
const TAX_NAME: Record<number, string> = {
  21: process.env.SMARTBILL_TAX_STANDARD ?? 'Normala',
  11: process.env.SMARTBILL_TAX_REDUCED ?? 'Redusa',
  0: process.env.SMARTBILL_TAX_EXEMPT ?? 'Scutit',
}

export class InvoiceError extends Error {}

export async function issueInvoice(orderId: string): Promise<{ series: string; number: string }> {
  if (!invoicingEnabled()) throw new InvoiceError('SmartBill nu este configurat (SMARTBILL_USER / SMARTBILL_TOKEN / SMARTBILL_CIF).')
  const o = await db.query.order.findFirst({ where: eq(order.id, orderId), with: { items: true } })
  if (!o) throw new InvoiceError('Comanda nu există.')
  if (o.invoiceNumber) return { series: o.invoiceSeries ?? '', number: o.invoiceNumber }
  const s = await getSettings()
  const bill = o.billingAddress ?? o.shippingAddress
  const isCompany = !!bill?.cui
  const lines = o.items.flatMap((it) =>
    it.priceBreakdown
      .filter((l) => l.amount > 0)
      .map((l) => ({
        name: l.code === 'frame' ? `${it.productName} · ${it.variantName}` : l.label,
        code: l.code === 'frame' ? it.sku : undefined,
        isDiscount: false,
        measuringUnitName: 'buc',
        currency: 'RON',
        quantity: it.quantity,
        price: l.amount / 100,
        isTaxIncluded: o.channel !== 'b2b',
        taxName: TAX_NAME[Math.round(it.vatRate)] ?? TAX_NAME[21],
        taxPercentage: Math.round(it.vatRate),
        isService: false,
        saveToDb: false,
      })),
  )
  if (o.discountTotal > 0) lines.push({ name: `Reducere${o.couponCode ? ` ${o.couponCode}` : ''}`, code: undefined, isDiscount: true, measuringUnitName: 'buc', currency: 'RON', quantity: 1, price: -o.discountTotal / 100, isTaxIncluded: true, taxName: TAX_NAME[21]!, taxPercentage: 21, isService: false, saveToDb: false })
  if (o.shippingTotal > 0) lines.push({ name: 'Transport', code: undefined, isDiscount: false, measuringUnitName: 'buc', currency: 'RON', quantity: 1, price: o.shippingTotal / 100, isTaxIncluded: true, taxName: TAX_NAME[21]!, taxPercentage: 21, isService: true, saveToDb: false })
  const body = {
    companyVatCode: process.env.SMARTBILL_CIF,
    seriesName: process.env.SMARTBILL_SERIES ?? 'SV',
    issueDate: zonedDay(new Date()),
    dueDate: o.channel === 'b2b' && o.partnerId ? undefined : zonedDay(new Date()),
    isDraft: false,
    client: {
      name: bill?.company || o.customerName,
      vatCode: bill?.cui || '-',
      regCom: bill?.regCom,
      isTaxPayer: isCompany && /^RO/i.test(bill?.cui ?? ''),
      address: bill?.street ?? s.company.address,
      city: bill?.city ?? s.company.city,
      county: bill?.county ?? s.company.county,
      country: 'Romania',
      email: o.email,
      saveToDb: false,
    },
    mentions: `Comanda ${o.number}`,
    observations: o.paymentMethod === 'card' ? `Plătită online${o.paymentRef ? ` (${o.paymentRef})` : ''}` : undefined,
    products: lines,
  }
  const res = await fetch(`${API}/invoice`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Basic ${Buffer.from(`${process.env.SMARTBILL_USER}:${process.env.SMARTBILL_TOKEN}`).toString('base64')}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  })
  const data = (await res.json().catch(() => ({}))) as { number?: string; series?: string; errorText?: string; url?: string }
  if (!res.ok || data.errorText || !data.number) throw new InvoiceError(data.errorText || `SmartBill a răspuns ${res.status}`)
  await db.update(order).set({ invoiceSeries: data.series ?? body.seriesName, invoiceNumber: data.number, invoiceUrl: data.url ?? null }).where(eq(order.id, o.id))
  await db.insert(orderEvent).values({ orderId: o.id, kind: 'invoice', message: `Factura ${data.series ?? body.seriesName}${data.number} emisă în SmartBill`, public: false })
  return { series: data.series ?? body.seriesName, number: data.number }
}

/** Fire-and-forget variant used after a payment is confirmed; failures are logged on the order. */
export async function issueInvoiceSafely(orderId: string) {
  if (!invoicingEnabled()) return
  try {
    await issueInvoice(orderId)
  } catch (e) {
    console.error('[invoice]', orderId, e)
    await db.insert(orderEvent).values({ orderId, kind: 'invoice', message: `Factura nu a putut fi emisă automat: ${e instanceof Error ? e.message : 'eroare'}. Emite-o din comandă.`, public: false })
  }
}
