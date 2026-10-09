import 'server-only'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { address, appointment, order, prescription, session, subscriber, user } from '@/lib/db/schema'
import { tryDecryptJson } from '@/lib/crypto'
import { deleteObject } from './storage'

/** GDPR art. 15/20 — everything we hold about a customer, machine-readable. */
export async function exportCustomerData(userId: string) {
  const [u, orders, rx, appts, addrs] = await Promise.all([
    db.query.user.findFirst({ where: eq(user.id, userId), columns: { id: true, name: true, email: true, phone: true, marketingConsent: true, createdAt: true } }),
    db.query.order.findMany({ where: eq(order.userId, userId), with: { items: true } }),
    db.select().from(prescription).where(eq(prescription.userId, userId)),
    db.select().from(appointment).where(eq(appointment.userId, userId)),
    db.select().from(address).where(eq(address.userId, userId)),
  ])
  const newsletter = u ? await db.query.subscriber.findFirst({ where: eq(subscriber.email, u.email), columns: { email: true, source: true, confirmedAt: true, unsubscribedAt: true, createdAt: true } }) : null
  return {
    exportedAt: new Date().toISOString(),
    controller: 'Sifra Vision SRL',
    user: u,
    addresses: addrs,
    orders: orders.map(({ accessToken: _t, internalNote: _n, ...o }) => o),
    prescriptions: rx.map((r) => ({ id: r.id, source: r.source, status: r.status, createdAt: r.createdAt, values: r.dataEnc ? tryDecryptJson(r.dataEnc) : null, hasFile: !!r.fileKey })),
    appointments: appts.map(({ manageToken: _m, staffNote: _s, ...a }) => a),
    newsletter,
  }
}

/**
 * GDPR art. 17 — erase a customer account. Prescriptions (health data),
 * addresses, sessions, newsletter subscription and the user row are deleted.
 * Orders are kept 10 years (Legea contabilității 82/1991) but detached.
 * Staff accounts are never erased through this path.
 */
export async function eraseCustomer(userId: string) {
  const u = await db.query.user.findFirst({ where: eq(user.id, userId), columns: { email: true, role: true } })
  if (!u || !['customer', 'partner'].includes(u.role ?? 'customer')) return false
  const rx = await db.select({ id: prescription.id, fileKey: prescription.fileKey }).from(prescription).where(eq(prescription.userId, userId))
  await db.transaction(async (tx) => {
    await tx.update(order).set({ userId: null, marketingConsent: false }).where(eq(order.userId, userId))
    await tx.update(appointment).set({ userId: null }).where(eq(appointment.userId, userId))
    if (rx.length) await tx.delete(prescription).where(inArray(prescription.id, rx.map((r) => r.id)))
    await tx.delete(address).where(eq(address.userId, userId))
    await tx.delete(session).where(eq(session.userId, userId))
    await tx.delete(subscriber).where(eq(sql`lower(${subscriber.email})`, u.email.toLowerCase()))
    await tx.delete(user).where(and(eq(user.id, userId), inArray(user.role, ['customer', 'partner'])))
  })
  for (const r of rx) if (r.fileKey) await deleteObject(r.fileKey).catch(() => {})
  return true
}
