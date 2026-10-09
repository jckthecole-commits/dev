'use server'

import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { order, subscriber } from '@/lib/db/schema'
import { randomToken } from '@/lib/crypto'
import { COUNTIES, isValidCui, normalizePhone } from '@/lib/ro'
import { OrderError, placeOrder } from '@/server/orders'
import { availableCardProvider, startCardPayment } from '@/server/payments'
import { rateLimit } from '@/server/rate-limit'
import { getCurrentUser } from '@/server/session'
import { getSettings } from '@/server/settings'

export type CheckoutState = { ok: false; error: string; fieldErrors?: Record<string, string> } | null

const str = (max: number) => z.string().trim().max(max)

const schema = z
  .object({
    email: z.email('Adresa de e-mail nu pare corectă.').max(160),
    phone: str(30).refine((v) => !!normalizePhone(v), 'Numărul de telefon nu pare corect (ex. 0722 123 456).'),
    firstName: str(60).min(1, 'Completează prenumele.'),
    lastName: str(60).min(1, 'Completează numele.'),
    shippingMethod: z.enum(['courier', 'easybox', 'pickup']),
    street: str(160).optional(),
    city: str(80).optional(),
    county: z.enum(COUNTIES).optional(),
    postalCode: str(12).optional(),
    locker: str(160).optional(),
    billingType: z.enum(['person', 'company']),
    company: str(160).optional(),
    cui: str(20).optional(),
    regCom: str(40).optional(),
    billingStreet: str(160).optional(),
    billingCity: str(80).optional(),
    billingCounty: z.enum(COUNTIES).optional(),
    paymentMethod: z.enum(['card', 'cod', 'transfer', 'store']),
    note: str(800).optional(),
    terms: z.literal('on', { error: 'Trebuie să accepți termenii și condițiile.' }),
    healthConsent: z.string().optional(),
    newsletter: z.string().optional(),
    requiresRx: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.shippingMethod === 'courier') {
      if (!d.street) ctx.addIssue({ code: 'custom', path: ['street'], message: 'Completează strada și numărul.' })
      if (!d.city) ctx.addIssue({ code: 'custom', path: ['city'], message: 'Completează localitatea.' })
      if (!d.county) ctx.addIssue({ code: 'custom', path: ['county'], message: 'Alege județul.' })
    }
    if (d.shippingMethod === 'easybox' && !d.locker) ctx.addIssue({ code: 'custom', path: ['locker'], message: 'Spune-ne ce easybox preferi (oraș + adresă sau cod).' })
    if (d.billingType === 'company') {
      if (!d.company) ctx.addIssue({ code: 'custom', path: ['company'], message: 'Completează denumirea firmei.' })
      if (!d.cui || !isValidCui(d.cui)) ctx.addIssue({ code: 'custom', path: ['cui'], message: 'CUI invalid (verificăm cifra de control).' })
      if (!d.billingStreet && d.shippingMethod !== 'courier') ctx.addIssue({ code: 'custom', path: ['billingStreet'], message: 'Completează adresa sediului.' })
    }
    if (d.requiresRx === '1' && d.healthConsent !== 'on') ctx.addIssue({ code: 'custom', path: ['healthConsent'], message: 'Avem nevoie de acordul tău pentru a folosi rețeta la realizarea lentilelor.' })
  })

export async function checkout(_: CheckoutState, formData: FormData): Promise<CheckoutState> {
  if (!(await rateLimit('checkout', 10, 600))) return { ok: false, error: 'Prea multe încercări. Reîncearcă în câteva minute.' }
  const parsed = schema.safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => v !== '')))
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message
    return { ok: false, error: 'Verifică câmpurile marcate.', fieldErrors }
  }
  const d = parsed.data
  const settings = await getSettings()
  const user = await getCurrentUser()
  const phone = normalizePhone(d.phone)!
  const name = `${d.firstName} ${d.lastName}`

  if (d.paymentMethod === 'card' && (!settings.payments.card.enabled || !availableCardProvider(settings.payments.card.provider))) return { ok: false, error: 'Plata cu cardul nu este disponibilă momentan. Alege altă metodă.' }
  if (d.paymentMethod === 'cod' && !settings.payments.cod.enabled) return { ok: false, error: 'Plata ramburs nu este disponibilă.' }
  if (d.paymentMethod === 'transfer' && !settings.payments.transfer.enabled) return { ok: false, error: 'Plata prin transfer nu este disponibilă.' }
  if (!settings.shipping[d.shippingMethod].enabled) return { ok: false, error: 'Metoda de livrare nu este disponibilă.' }

  const shippingAddress =
    d.shippingMethod === 'courier'
      ? { name, phone, street: d.street!, city: d.city!, county: d.county!, postalCode: d.postalCode, country: 'RO' }
      : d.shippingMethod === 'easybox'
        ? { name, phone, street: d.locker!, city: d.city ?? '', county: d.county ?? '', country: 'RO', lockerName: d.locker }
        : null
  const billingAddress =
    d.billingType === 'company'
      ? { name, phone, company: d.company, cui: d.cui!.toUpperCase().replace(/\s/g, ''), regCom: d.regCom, street: d.billingStreet ?? d.street ?? '', city: d.billingCity ?? d.city ?? '', county: d.billingCounty ?? d.county ?? '', country: 'RO' }
      : shippingAddress

  let placed
  try {
    placed = await placeOrder({
      email: d.email.toLowerCase(),
      phone,
      customerName: name,
      shippingMethod: d.shippingMethod,
      shippingAddress,
      billingAddress,
      paymentMethod: d.paymentMethod,
      customerNote: d.note,
      marketingConsent: d.newsletter === 'on',
      userId: user?.id ?? null,
    })
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.message }
    console.error('[checkout]', e)
    return { ok: false, error: 'Nu am putut plasa comanda. Te rugăm să încerci din nou.' }
  }
  const o = placed.order

  if (d.newsletter === 'on') {
    await db.insert(subscriber).values({ email: o.email, source: 'checkout', confirmToken: randomToken() }).onConflictDoNothing()
  }

  if (d.paymentMethod === 'card') {
    const provider = availableCardProvider(settings.payments.card.provider)!
    let url: string
    try {
      const pay = await startCardPayment(provider, {
        id: o.id,
        number: o.number,
        accessToken: o.accessToken,
        total: o.total,
        email: o.email,
        phone: o.phone,
        customerName: o.customerName,
        address: shippingAddress ? { street: shippingAddress.street, city: shippingAddress.city, county: shippingAddress.county, postalCode: d.postalCode } : null,
        items: placed.lines.map((l) => ({ name: `${l.product.name} ${l.variant.colorName}`, sku: l.variant.sku, amount: l.priced.unitPrice * l.quantity, vatRate: settings.vat[l.product.vatClass] })),
      })
      await db.update(order).set({ paymentProvider: provider, paymentRef: pay.ref }).where(eq(order.id, o.id))
      url = pay.url
    } catch (e) {
      console.error('[payment]', e)
      redirect(`/comanda/${o.number}?t=${o.accessToken}&eroare=plata`)
    }
    redirect(url)
  }
  redirect(`/comanda/${o.number}?t=${o.accessToken}&nou=1`)
}
