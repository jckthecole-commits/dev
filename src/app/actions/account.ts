'use server'

import { and, eq, inArray } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { refresh } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { address, appointment, order, prescription, session, user } from '@/lib/db/schema'
import { normalizePhone } from '@/lib/ro'
import { audit } from '@/server/audit'
import { auth } from '@/server/auth'
import { requireUser } from '@/server/session'
import { deleteObject } from '@/server/storage'

export async function updateProfile(_: unknown, formData: FormData): Promise<{ ok: boolean; message: string }> {
  const u = await requireUser()
  const parsed = z
    .object({ name: z.string().trim().min(2).max(80), phone: z.string().trim().max(30).optional(), marketing: z.string().optional() })
    .safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, message: 'Verifică datele.' }
  const phone = parsed.data.phone ? normalizePhone(parsed.data.phone) : null
  if (parsed.data.phone && !phone) return { ok: false, message: 'Numărul de telefon nu pare corect.' }
  await db.update(user).set({ name: parsed.data.name, phone, marketingConsent: parsed.data.marketing === 'on' }).where(eq(user.id, u.id))
  refresh()
  return { ok: true, message: 'Salvat.' }
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() })
  redirect('/')
}

/**
 * GDPR art. 17 — erase the account. Prescriptions, addresses, sessions and the
 * user are deleted; orders are kept for 10 years (accounting law) but
 * anonymised and detached from the account.
 */
export async function deleteAccount(formData: FormData) {
  const u = await requireUser()
  if (String(formData.get('confirm') ?? '').trim().toUpperCase() !== 'ȘTERGE') redirect('/cont?sters=0')
  const rx = await db.select({ id: prescription.id, fileKey: prescription.fileKey }).from(prescription).where(eq(prescription.userId, u.id))
  await db.transaction(async (tx) => {
    await tx.update(order).set({ userId: null, marketingConsent: false }).where(eq(order.userId, u.id))
    await tx.update(appointment).set({ userId: null }).where(eq(appointment.userId, u.id))
    if (rx.length) await tx.delete(prescription).where(inArray(prescription.id, rx.map((r) => r.id)))
    await tx.delete(address).where(eq(address.userId, u.id))
    await tx.delete(session).where(eq(session.userId, u.id))
    await tx.delete(user).where(and(eq(user.id, u.id), eq(user.role, 'customer')))
  })
  for (const r of rx) if (r.fileKey) await deleteObject(r.fileKey)
  await audit({ id: u.id, email: u.email }, 'account.delete', 'user', u.id)
  redirect('/?cont-sters=1')
}
