import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { address, appointment, order, prescription, user } from '@/lib/db/schema'
import { decryptJson } from '@/lib/crypto'
import { auth } from '@/server/auth'

/** GDPR art. 15/20 — machine-readable export of everything we hold about the user. */
export async function GET() {
  const s = await auth.api.getSession({ headers: await headers() })
  if (!s) return new Response('Unauthorized', { status: 401 })
  const id = s.user.id
  const [u, orders, rx, appts, addrs] = await Promise.all([
    db.query.user.findFirst({ where: eq(user.id, id), columns: { id: true, name: true, email: true, phone: true, marketingConsent: true, createdAt: true } }),
    db.query.order.findMany({ where: eq(order.userId, id), with: { items: true } }),
    db.select().from(prescription).where(eq(prescription.userId, id)),
    db.select().from(appointment).where(eq(appointment.userId, id)),
    db.select().from(address).where(eq(address.userId, id)),
  ])
  const data = {
    exportedAt: new Date().toISOString(),
    controller: 'Sifra Vision SRL',
    user: u,
    addresses: addrs,
    orders: orders.map(({ accessToken: _t, internalNote: _n, ...o }) => o),
    prescriptions: rx.map((r) => ({ id: r.id, source: r.source, status: r.status, createdAt: r.createdAt, values: r.dataEnc ? decryptJson(r.dataEnc) : null, hasFile: !!r.fileKey })),
    appointments: appts.map(({ manageToken: _m, staffNote: _s, ...a }) => a),
  }
  return new Response(JSON.stringify(data, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="sifra-vision-date-${new Date().toISOString().slice(0, 10)}.json"`, 'cache-control': 'no-store' },
  })
}
