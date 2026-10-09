'use server'

import { and, eq, inArray, sql } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { inventory, location, order, orderEvent, orderItem, partner, product, variant } from '@/lib/db/schema'
import { randomToken } from '@/lib/crypto'
import { formatPrice } from '@/lib/format'
import { partnerPrice } from '@/lib/pricing'
import { COUNTIES, isValidCui, normalizePhone } from '@/lib/ro'
import { audit } from '@/server/audit'
import { sendMail, staffInbox } from '@/server/mail'
import { emailButton, emailLayout } from '@/server/mail-templates'
import { rateLimit } from '@/server/rate-limit'
import { getMyPartner } from '@/server/b2b'
import { getCurrentUser } from '@/server/session'
import { getSettings } from '@/server/settings'

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

const appSchema = z.object({
  companyName: z.string().trim().min(2, 'Completează denumirea firmei.').max(160),
  cui: z.string().trim().refine(isValidCui, 'CUI invalid (verificăm cifra de control).'),
  regCom: z.string().trim().max(40).optional(),
  address: z.string().trim().min(4, 'Completează adresa.').max(200),
  city: z.string().trim().min(2, 'Completează localitatea.').max(80),
  county: z.enum(COUNTIES, { error: 'Alege județul.' }),
  contactName: z.string().trim().min(2, 'Completează persoana de contact.').max(80),
  email: z.email('E-mail invalid.'),
  phone: z.string().trim().refine((v) => !!normalizePhone(v), 'Telefon invalid.'),
  storesCount: z.coerce.number().int().min(1).max(500).optional(),
  website: z.string().trim().max(200).optional(),
  message: z.string().trim().max(1500).optional(),
  consent: z.literal('on', { error: 'Avem nevoie de acordul pentru prelucrarea datelor.' }),
})

export type ApplyState = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> } | null

export async function applyPartner(_: ApplyState, formData: FormData): Promise<ApplyState> {
  if (formData.get('hp')) return { ok: true }
  if (!(await rateLimit('b2b:apply', 3, 3600))) return { ok: false, error: 'Ai trimis deja o cerere. Revenim curând.' }
  const parsed = appSchema.safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => v !== '')))
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message
    return { ok: false, error: 'Verifică câmpurile marcate.', fieldErrors }
  }
  const d = parsed.data
  const cui = d.cui.toUpperCase().replace(/\s/g, '')
  const existing = await db.query.partner.findFirst({ where: eq(partner.cui, cui) })
  if (existing) return { ok: false, error: 'Există deja o cerere pentru acest CUI. Te contactăm în curând.' }
  const user = await getCurrentUser()
  await db.insert(partner).values({ ...d, cui, phone: normalizePhone(d.phone)!, email: d.email.toLowerCase(), userId: user?.id ?? null, status: 'pending' })
  after(async () => {
    await sendMail({
      to: d.email,
      subject: 'Am primit cererea de parteneriat SIFRA',
      html: emailLayout({ preheader: 'Revenim în 1–2 zile lucrătoare.', title: 'Mulțumim pentru interes!', body: `<p>Am primit cererea pentru <strong>${d.companyName}</strong>. Un coleg din echipa de distribuție verifică datele și revine în 1–2 zile lucrătoare cu oferta de prețuri și accesul în portal.</p>` }),
    })
    const staff = staffInbox()
    if (staff) await sendMail({ to: staff, subject: `Cerere B2B: ${d.companyName} (${d.city})`, html: emailLayout({ preheader: cui, title: 'Cerere nouă de partener', body: `<p>${d.companyName} · ${cui} · ${d.city}, ${d.county}<br>${d.contactName} · ${d.phone} · ${d.email}</p>${d.message ? `<p>„${d.message}”</p>` : ''}${emailButton(`${SITE}/admin/parteneri`, 'Vezi în admin')}` }) })
  })
  return { ok: true }
}

export type QuickOrderState = { ok: true; number: string } | { ok: false; error: string; unknown?: string[] } | null

/** Quick order: lines "SKU qty" (or "SKU;qty"). Prices are net wholesale + VAT. */
export async function placePartnerOrder(_: QuickOrderState, formData: FormData): Promise<QuickOrderState> {
  const me = await getMyPartner()
  if (!me) return { ok: false, error: 'Contul de partener nu este activ.' }
  const settings = await getSettings()
  const lines = String(formData.get('lines') ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^([A-Za-z0-9-]+)[\s;,x×*]+(\d{1,4})$/)
      return m ? { sku: m[1]!.toUpperCase(), qty: Number(m[2]) } : { sku: l.toUpperCase(), qty: 0 }
    })
  if (!lines.length) return { ok: false, error: 'Adaugă cel puțin un produs.' }
  const merged = new Map<string, number>()
  for (const l of lines) merged.set(l.sku, (merged.get(l.sku) ?? 0) + l.qty)
  const rows = await db
    .select({ v: variant, p: product })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .where(and(inArray(variant.sku, [...merged.keys()]), eq(variant.active, true), eq(product.status, 'active')))
  const unknown = [...merged.keys()].filter((k) => !rows.some((r) => r.v.sku === k))
  if (unknown.length) return { ok: false, error: `Coduri necunoscute: ${unknown.join(', ')}`, unknown }
  const bad = [...merged.entries()].filter(([, q]) => q <= 0)
  if (bad.length) return { ok: false, error: `Cantitate lipsă pentru: ${bad.map(([s]) => s).join(', ')} (format: COD cantitate)` }

  const priced = rows.map(({ v, p }) => {
    const qty = merged.get(v.sku)!
    const net = partnerPrice(p.wholesalePrice ?? Math.round(p.price / 2.4), me.partner.discountPercent)
    return { v, p, qty, net, lineNet: net * qty }
  })
  const subtotalNet = priced.reduce((s, l) => s + l.lineNet, 0)
  if (subtotalNet < settings.b2b.minOrder) return { ok: false, error: `Comanda minimă este ${formatPrice(settings.b2b.minOrder)} fără TVA.` }
  const vat = Math.round((subtotalNet * settings.vat.standard) / 100)
  const total = subtotalNet + vat

  try {
    const created = await db.transaction(async (tx) => {
      const seq = await tx.execute<{ n: number }>(sql`select nextval('order_number_seq')::int as n`)
      const number = `SVB-${new Date().getFullYear()}-${String(seq[0]!.n).padStart(6, '0')}`
      const [o] = await tx
        .insert(order)
        .values({
          number,
          accessToken: randomToken(18),
          channel: 'b2b',
          userId: me.user.id,
          partnerId: me.partner.id,
          email: me.partner.email,
          phone: me.partner.phone,
          customerName: me.partner.companyName,
          status: 'placed',
          paymentMethod: 'transfer',
          shippingMethod: 'courier',
          shippingAddress: { name: me.partner.contactName, phone: me.partner.phone, street: me.partner.address, city: me.partner.city, county: me.partner.county, country: 'RO', company: me.partner.companyName },
          billingAddress: { name: me.partner.contactName, phone: me.partner.phone, street: me.partner.address, city: me.partner.city, county: me.partner.county, country: 'RO', company: me.partner.companyName, cui: me.partner.cui, regCom: me.partner.regCom ?? undefined },
          subtotal: subtotalNet,
          vatTotal: vat,
          total,
          customerNote: String(formData.get('note') ?? '').slice(0, 800) || null,
          placedAt: new Date(),
        })
        .returning()
      for (const l of priced) {
        // B2B ships from the warehouse first
        const locs = await tx.select({ id: location.id, kind: location.kind }).from(location).where(eq(location.sellable, true))
        locs.sort((a, b) => (a.kind === 'warehouse' ? -1 : 1) - (b.kind === 'warehouse' ? -1 : 1))
        let reservedAt: string | null = null
        for (const loc of locs) {
          const r = await tx
            .update(inventory)
            .set({ reserved: sql`${inventory.reserved} + ${l.qty}` })
            .where(and(eq(inventory.variantId, l.v.id), eq(inventory.locationId, loc.id), sql`${inventory.onHand} - ${inventory.reserved} >= ${l.qty}`))
            .returning({ v: inventory.variantId })
          if (r.length) {
            reservedAt = loc.id
            break
          }
        }
        if (!reservedAt) throw new Error(`Stoc insuficient pentru ${l.v.sku}`)
        await tx.insert(orderItem).values({
          orderId: o!.id,
          variantId: l.v.id,
          productId: l.p.id,
          productName: l.p.name,
          variantName: l.v.colorName,
          sku: l.v.sku,
          quantity: l.qty,
          unitPrice: l.net,
          lineTotal: l.lineNet,
          vatRate: settings.vat.standard,
          configuration: { lensType: 'none', treatments: [] },
          priceBreakdown: [{ code: 'frame', label: `${l.p.name} · ${l.v.colorName} (net)`, amount: l.net }],
          stockLocationId: reservedAt,
          frameSnapshot: { lensWidth: l.p.lensWidth, bridgeWidth: l.p.bridgeWidth, templeLength: l.p.templeLength, lensHeight: l.p.lensHeight, shape: l.p.shape },
        })
      }
      await tx.insert(orderEvent).values({ orderId: o!.id, kind: 'status', toStatus: 'placed', message: 'Comandă B2B plasată din portal', public: true, actorId: me.user.id, actorName: me.partner.companyName })
      return o!
    })
    revalidateTag('stock', { expire: 0 })
    await audit(me.user, 'b2b.order', 'order', created.id, { total })
    after(async () => {
      const staff = staffInbox()
      if (staff) await sendMail({ to: staff, subject: `Comandă B2B ${created.number} · ${me.partner.companyName} · ${formatPrice(total)}`, html: emailLayout({ preheader: me.partner.companyName, title: `Comandă B2B ${created.number}`, body: `<p>${priced.map((l) => `${l.qty}× ${l.v.sku}`).join('<br>')}</p><p>Net ${formatPrice(subtotalNet)} + TVA ${formatPrice(vat)} = <strong>${formatPrice(total)}</strong></p>${emailButton(`${SITE}/admin/comenzi/${created.id}`, 'Deschide comanda')}` }) })
      await sendMail({ to: me.partner.email, subject: `Comanda ${created.number} a fost înregistrată`, html: emailLayout({ preheader: formatPrice(total), title: 'Comandă înregistrată', body: `<p>Mulțumim! Pregătim comanda ${created.number} în ${settings.b2b.leadDays}. Factura proformă vine pe e-mail; termen de plată: ${me.partner.paymentTermsDays || 0} zile.</p><p>Net ${formatPrice(subtotalNet)} · TVA ${formatPrice(vat)} · <strong>Total ${formatPrice(total)}</strong></p>` }) })
    })
    return { ok: true, number: created.number }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Comanda nu a putut fi plasată.' }
  }
}
