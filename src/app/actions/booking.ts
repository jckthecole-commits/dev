'use server'

import { and, asc, eq, gte, inArray, lt, ne, sql } from 'drizzle-orm'
import { after } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { appointment, scheduleException, service } from '@/lib/db/schema'
import { icsEvent, slotsForDay } from '@/lib/booking'
import { randomToken, safeEqual } from '@/lib/crypto'
import { formatDate, formatTime } from '@/lib/format'
import { normalizePhone } from '@/lib/ro'
import { addDays, zonedDay, zonedToUtc } from '@/lib/time'
import { sendMail, staffInbox } from '@/server/mail'
import { emailButton, emailLayout } from '@/server/mail-templates'
import { rateLimit } from '@/server/rate-limit'
import { getCurrentUser } from '@/server/session'
import { getSettings } from '@/server/settings'

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const EXCLUSIVE = ['consult', 'contact'] // need the optometrist

async function busyBetween(from: Date, to: Date) {
  return db
    .select({ startsAt: appointment.startsAt, endsAt: appointment.endsAt, serviceCode: service.code })
    .from(appointment)
    .innerJoin(service, eq(service.id, appointment.serviceId))
    .where(and(gte(appointment.endsAt, from), lt(appointment.startsAt, to), inArray(appointment.status, ['booked', 'confirmed'])))
}

/** Availability for a service over a range of days (one round-trip). */
export async function getAvailability(serviceCode: string, fromDay: string, days: number): Promise<Record<string, string[]>> {
  const [settings, svc] = await Promise.all([getSettings(), db.query.service.findFirst({ where: and(eq(service.code, serviceCode), eq(service.active, true)) })])
  if (!svc) return {}
  const n = Math.min(Math.max(days, 1), 42)
  const today = zonedDay(new Date())
  const start = fromDay < today ? today : fromDay
  const end = addDays(start, n)
  const horizon = addDays(today, settings.booking.horizonDays)
  const [busy, exceptions] = await Promise.all([
    busyBetween(zonedToUtc(start, '00:00'), zonedToUtc(end, '00:00')),
    db.select().from(scheduleException).where(and(gte(scheduleException.day, start), lt(scheduleException.day, end))),
  ])
  const out: Record<string, string[]> = {}
  for (let i = 0; i < n; i++) {
    const day = addDays(start, i)
    out[day] =
      day > horizon
        ? []
        : slotsForDay({
            day,
            service: { code: svc.code, durationMin: svc.durationMin, capacity: svc.capacity },
            weekly: settings.hours.weekly,
            exceptions: exceptions.map((e) => ({ day: e.day, closed: e.closed, opens: e.opens, closes: e.closes })),
            busy,
            step: settings.booking.slotStepMin,
            now: new Date(),
            leadMinutes: settings.booking.leadTimeHours * 60,
            exclusiveCodes: EXCLUSIVE,
          })
  }
  return out
}

const schema = z.object({
  service: z.string().max(32),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().trim().min(2, 'Spune-ne cum te numești.').max(80),
  email: z.email('Adresa de e-mail nu pare corectă.'),
  phone: z.string().trim().refine((v) => !!normalizePhone(v), 'Numărul de telefon nu pare corect.'),
  note: z.string().trim().max(500).optional(),
  consent: z.literal('on', { error: 'Avem nevoie de acordul tău pentru a te contacta legat de programare.' }),
})

export type BookingState = { ok: true; token: string } | { ok: false; error: string; fieldErrors?: Record<string, string> } | null

export async function book(_: BookingState, formData: FormData): Promise<BookingState> {
  if (formData.get('website')) return { ok: false, error: 'Eroare.' }
  if (!(await rateLimit('booking', 6, 3600))) return { ok: false, error: 'Prea multe programări într-un timp scurt. Sună-ne și te ajutăm.' }
  const parsed = schema.safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => v !== '')))
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Verifică datele.', fieldErrors }
  }
  const d = parsed.data
  const svc = await db.query.service.findFirst({ where: and(eq(service.code, d.service), eq(service.active, true)) })
  if (!svc) return { ok: false, error: 'Serviciul nu mai este disponibil.' }
  const user = await getCurrentUser()
  const startsAt = zonedToUtc(d.day, d.time)
  const endsAt = new Date(startsAt.getTime() + svc.durationMin * 60000)
  const token = randomToken(18)

  const result = await db.transaction(async (tx) => {
    // serialise bookings per day — no double booking under concurrency
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`booking:${d.day}`}))`)
    const avail = await getAvailability(d.service, d.day, 1)
    if (!avail[d.day]?.includes(d.time)) return null
    const [row] = await tx
      .insert(appointment)
      .values({ serviceId: svc.id, userId: user?.id ?? null, startsAt, endsAt, name: d.name, email: d.email.toLowerCase(), phone: normalizePhone(d.phone)!, note: d.note ?? null, manageToken: token })
      .returning()
    return row
  })
  if (!result) return { ok: false, error: 'Intervalul tocmai a fost ocupat. Alege altă oră.' }

  after(async () => {
    const settings = await getSettings()
    const location = `${settings.company.brand}, ${settings.company.address}, ${settings.company.city}`
    const manage = `${SITE}/programare/${token}`
    const when = `${formatDate(startsAt, { weekday: 'long', day: 'numeric', month: 'long' })}, ora ${formatTime(startsAt)}`
    await sendMail({
      to: d.email,
      subject: `Programare confirmată: ${svc.name} — ${when}`,
      html: emailLayout({
        preheader: `${when} · ${location}`,
        title: 'Te așteptăm!',
        body: `<p><strong>${svc.name}</strong><br>${when} · ${svc.durationMin} min</p><p>${location}</p><p style="color:#4A545B">Adu, dacă ai, ochelarii actuali și ultima rețetă. Dacă porți lentile de contact, scoate-le cu cel puțin o oră înainte de consultație.</p>${emailButton(manage, 'Vezi sau anulează programarea')}`,
      }),
      attachments: [{ filename: 'programare-sifra.ics', contentType: 'text/calendar; charset=utf-8', content: icsEvent({ uid: result.id, start: startsAt, end: endsAt, title: `${svc.name} — Sifra Vision`, description: `Programare ${svc.name}. Gestionează: ${manage}`, location, url: manage }) }],
    })
    const staff = staffInbox()
    if (staff) await sendMail({ to: staff, subject: `Programare nouă: ${svc.name} · ${when}`, html: emailLayout({ preheader: d.name, title: 'Programare nouă', body: `<p>${d.name} · ${d.phone} · ${d.email}</p><p>${svc.name} · ${when}</p>${d.note ? `<p>„${d.note}”</p>` : ''}${emailButton(`${SITE}/admin/programari`, 'Agenda în admin')}` }) })
  })
  return { ok: true, token }
}

export async function cancelBooking(token: string): Promise<{ ok: boolean; message: string }> {
  const row = await db.query.appointment.findFirst({ where: eq(appointment.manageToken, token) })
  if (!row || !safeEqual(token, row.manageToken)) return { ok: false, message: 'Programarea nu a fost găsită.' }
  if (row.startsAt < new Date()) return { ok: false, message: 'Programarea a trecut deja.' }
  await db.update(appointment).set({ status: 'cancelled' }).where(and(eq(appointment.id, row.id), ne(appointment.status, 'cancelled')))
  return { ok: true, message: 'Programarea a fost anulată. Te așteptăm altă dată!' }
}

export async function listServices() {
  return db.select({ code: service.code, name: service.name, summary: service.summary, durationMin: service.durationMin, price: service.price }).from(service).where(eq(service.active, true)).orderBy(asc(service.position))
}
