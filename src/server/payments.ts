import 'server-only'
import { createHash, createVerify } from 'node:crypto'
import Stripe from 'stripe'

/**
 * Card payments. Providers:
 *  - Netopia Payments API v2 (default for Romania)
 *  - Stripe Checkout
 *  - Simulator (development only) — lets you test the full flow without keys
 */
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

export type CardProvider = 'netopia' | 'stripe' | 'simulated'

export function availableCardProvider(preferred: 'netopia' | 'stripe'): CardProvider | null {
  const netopia = !!(process.env.NETOPIA_API_KEY && process.env.NETOPIA_POS_SIGNATURE)
  const stripe = !!process.env.STRIPE_SECRET_KEY
  if (preferred === 'netopia' && netopia) return 'netopia'
  if (preferred === 'stripe' && stripe) return 'stripe'
  if (netopia) return 'netopia'
  if (stripe) return 'stripe'
  if (process.env.NODE_ENV !== 'production' || process.env.ALLOW_SIMULATED_PAYMENTS === 'true') return 'simulated'
  return null
}

export type PaymentOrder = {
  id: string
  number: string
  accessToken: string
  total: number
  email: string
  phone: string
  customerName: string
  address: { street: string; city: string; county: string; postalCode?: string } | null
  items: { name: string; sku: string; amount: number; vatRate: number }[]
}

const returnUrl = (o: PaymentOrder) => `${SITE}/comanda/${o.number}?t=${o.accessToken}&plata=1`

export async function startCardPayment(provider: CardProvider, o: PaymentOrder): Promise<{ url: string; ref: string | null }> {
  if (provider === 'simulated') return { url: `${SITE}/plata/simulare?o=${o.number}&t=${o.accessToken}`, ref: `SIM-${o.number}` }
  if (provider === 'stripe') {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: o.email,
      locale: 'ro',
      client_reference_id: o.id,
      metadata: { orderId: o.id, orderNumber: o.number },
      line_items: [{ quantity: 1, price_data: { currency: 'ron', unit_amount: o.total, product_data: { name: `Comanda ${o.number} — Sifra Vision` } } }],
      success_url: returnUrl(o),
      cancel_url: `${returnUrl(o)}&anulat=1`,
    })
    return { url: session.url!, ref: session.id }
  }
  // Netopia API v2
  const base = process.env.NETOPIA_SANDBOX === 'false' ? 'https://secure.netopia-payments.com' : 'https://secure-sandbox.netopia-payments.com'
  const [firstName, ...rest] = o.customerName.split(' ')
  const person = {
    email: o.email,
    phone: o.phone,
    firstName: firstName ?? o.customerName,
    lastName: rest.join(' ') || firstName || '-',
    city: o.address?.city ?? 'Galați',
    country: 642,
    countryName: 'Romania',
    state: o.address?.county ?? 'Galați',
    postalCode: o.address?.postalCode ?? '',
    details: o.address?.street ?? 'Ridicare din showroom',
  }
  const body = {
    config: { emailTemplate: '', emailSubject: '', notifyUrl: `${SITE}/api/webhooks/netopia`, redirectUrl: returnUrl(o), cancelUrl: `${returnUrl(o)}&anulat=1`, language: 'ro' },
    payment: { options: { installments: 0, bonus: 0 }, data: {} },
    order: {
      ntpID: '',
      posSignature: process.env.NETOPIA_POS_SIGNATURE,
      dateTime: new Date().toISOString(),
      description: `Comanda ${o.number} — Sifra Vision`,
      orderID: o.number,
      amount: Math.round(o.total) / 100,
      currency: 'RON',
      billing: person,
      shipping: person,
      products: o.items.map((i) => ({ name: i.name.slice(0, 100), code: i.sku, category: 'Ochelari', price: i.amount / 100, vat: i.vatRate })),
      installments: { selected: 0, available: 0 },
      data: {},
    },
  }
  const res = await fetch(`${base}/payment/card/start`, {
    method: 'POST',
    headers: { Authorization: process.env.NETOPIA_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as { payment?: { paymentURL?: string; ntpID?: string }; error?: { code?: string; message?: string } }
  if (!res.ok || !data.payment?.paymentURL) throw new Error(`Netopia: ${data.error?.message ?? res.status}`)
  return { url: data.payment.paymentURL, ref: data.payment.ntpID ?? null }
}

/* ── Netopia IPN verification (JWT RS512 + SHA-512 payload hash) ─────────── */

export const NETOPIA_STATUS = { PAID: 3, CANCELED: 4, CONFIRMED: 5, CREDIT: 8, ERROR: 11, DECLINED: 12, FRAUD: 13 } as const

export function verifyNetopiaIpn(token: string | null, rawBody: string): { ok: true; payload: { order?: { orderID?: string }; payment?: { status?: number; ntpID?: string; amount?: number } } } | { ok: false; reason: string } {
  const publicKey = process.env.NETOPIA_PUBLIC_KEY?.replace(/\\n/g, '\n')
  const pos = process.env.NETOPIA_POS_SIGNATURE
  if (!token || !publicKey || !pos) return { ok: false, reason: 'missing token or keys' }
  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false, reason: 'malformed token' }
  const [h, p, sig] = parts as [string, string, string]
  const header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8')) as { alg?: string; typ?: string }
  if (header.typ !== 'JWT') return { ok: false, reason: 'not a JWT' }
  const alg = header.alg === 'RS256' ? 'RSA-SHA256' : header.alg === 'RS384' ? 'RSA-SHA384' : 'RSA-SHA512'
  const verifier = createVerify(alg)
  verifier.update(`${h}.${p}`)
  if (!verifier.verify(publicKey, Buffer.from(sig, 'base64url'))) return { ok: false, reason: 'bad signature' }
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as { iss?: string; aud?: string[] | string; sub?: string; exp?: number; nbf?: number }
  if (claims.iss !== 'NETOPIA Payments') return { ok: false, reason: 'bad issuer' }
  const aud = Array.isArray(claims.aud) ? claims.aud[0] : claims.aud
  if (aud !== pos) return { ok: false, reason: 'bad audience' }
  const now = Math.floor(Date.now() / 1000)
  if (claims.exp && claims.exp < now - 60) return { ok: false, reason: 'expired' }
  const hash = createHash('sha512').update(rawBody).digest('base64')
  if (hash !== claims.sub) return { ok: false, reason: 'tainted payload' }
  return { ok: true, payload: JSON.parse(rawBody) }
}

export function stripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}
