'use server'

import { eq } from 'drizzle-orm'
import { refresh } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { appointment, inquiry, scheduleException } from '@/lib/db/schema'
import { formatDate, formatTime } from '@/lib/format'
import { SITE_URL } from '@/lib/seo'
import { audit } from '@/server/audit'
import { sendMail } from '@/server/mail'
import { emailButton, emailLayout } from '@/server/mail-templates'
import { requireStaff } from '@/server/session'

type R = { ok: boolean; message?: string; error?: string; fieldErrors?: Record<string, string> }
const STATUSES = ['booked', 'confirmed', 'completed', 'no_show', 'cancelled'] as const

export async function setAppointmentStatus(id: string, status: (typeof STATUSES)[number]): Promise<R> {
  const me = await requireStaff('appointments:write')
  if (!STATUSES.includes(status)) return { ok: false, error: 'Status invalid.' }
  const a = await db.query.appointment.findFirst({ where: eq(appointment.id, id), with: { service: true } })
  if (!a) return { ok: false, error: 'Programarea nu există.' }
  await db.update(appointment).set({ status, updatedAt: new Date() }).where(eq(appointment.id, id))
  await audit(me, 'appointment.status', 'appointment', id, { from: a.status, to: status })
  if (status === 'cancelled' && a.status !== 'cancelled') {
    const when = `${formatDate(a.startsAt, { weekday: 'long', day: 'numeric', month: 'long' })}, ora ${formatTime(a.startsAt)}`
    after(() =>
      sendMail({
        to: a.email,
        subject: `Programarea din ${when} a fost anulată`,
        html: emailLayout({ preheader: a.service.name, title: 'Programare anulată', body: `<p>Bună, ${a.name.split(' ')[0]}! Programarea pentru <strong>${a.service.name}</strong> (${when}) a fost anulată de showroom. Ne pare rău pentru neplăcere — te sunăm pentru o altă oră sau poți alege una nouă online.</p>${emailButton(`${SITE_URL}/programare`, 'Alege altă oră')}` }),
      }),
    )
  }
  refresh()
  return { ok: true, message: 'Actualizat.' }
}

export async function saveStaffNote(id: string, _: unknown, fd: FormData): Promise<R> {
  const me = await requireStaff('appointments:write')
  const note = String(fd.get('staffNote') ?? '').trim().slice(0, 2000)
  await db.update(appointment).set({ staffNote: note || null, updatedAt: new Date() }).where(eq(appointment.id, id))
  await audit(me, 'appointment.note', 'appointment', id)
  refresh()
  return { ok: true, message: 'Notă salvată.' }
}

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format HH:MM')
const exceptionSchema = z
  .object({
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Alege ziua'),
    mode: z.enum(['closed', 'hours']),
    opens: hhmm.optional().or(z.literal('')),
    closes: hhmm.optional().or(z.literal('')),
    note: z.string().max(200).optional(),
  })
  .refine((v) => v.mode === 'closed' || (v.opens && v.closes && v.opens < v.closes), { message: 'Ora de deschidere trebuie să fie înainte de închidere.', path: ['closes'] })

export async function addScheduleException(_: unknown, fd: FormData): Promise<R> {
  const me = await requireStaff('appointments:write')
  const d = exceptionSchema.safeParse(Object.fromEntries(fd))
  if (!d.success) return { ok: false, error: 'Verifică datele.', fieldErrors: Object.fromEntries(d.error.issues.map((i) => [String(i.path[0] ?? 'zi'), i.message])) }
  const v = { day: d.data.day, closed: d.data.mode === 'closed', opens: d.data.mode === 'hours' ? d.data.opens || null : null, closes: d.data.mode === 'hours' ? d.data.closes || null : null, note: d.data.note || null }
  await db.insert(scheduleException).values(v).onConflictDoUpdate({ target: scheduleException.day, set: v })
  await audit(me, 'schedule.exception', 'schedule_exception', d.data.day, v)
  refresh()
  return { ok: true, message: 'Excepție salvată. Disponibilitatea online s-a actualizat.' }
}

export async function removeScheduleException(id: string): Promise<R> {
  const me = await requireStaff('appointments:write')
  await db.delete(scheduleException).where(eq(scheduleException.id, id))
  await audit(me, 'schedule.exception.remove', 'schedule_exception', id)
  refresh()
  return { ok: true }
}

export async function setInquiryStatus(id: string, status: 'new' | 'open' | 'closed'): Promise<R> {
  const me = await requireStaff('orders:write')
  if (!['new', 'open', 'closed'].includes(status)) return { ok: false, error: 'Status invalid.' }
  await db.update(inquiry).set({ status, updatedAt: new Date() }).where(eq(inquiry.id, id))
  await audit(me, 'inquiry.status', 'inquiry', id, { status })
  refresh()
  return { ok: true }
}
