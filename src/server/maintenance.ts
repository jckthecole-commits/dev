import 'server-only'
import { and, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { appointment, cart, order, rateLimit, session, verification } from '@/lib/db/schema'
import { formatDate, formatTime } from '@/lib/format'
import { SITE_URL } from '@/lib/seo'
import { sendMail } from './mail'
import { emailButton, emailLayout } from './mail-templates'
import { transitionOrder } from './orders'
import { getSettings } from './settings'

/** Card payments not completed within this window are cancelled and their stock released. */
const PAYMENT_TIMEOUT_MIN = 90

/**
 * Periodic housekeeping — run every ~15 minutes (see /api/cron/maintenance).
 * Idempotent: every step only touches rows that still need it.
 */
export async function runMaintenance(now = new Date()) {
  const report: Record<string, number> = {}

  // 1. Abandoned card payments → cancel (releases reserved stock).
  const stale = await db.select({ id: order.id }).from(order).where(and(eq(order.status, 'pending_payment'), lt(order.createdAt, new Date(now.getTime() - PAYMENT_TIMEOUT_MIN * 60_000)))).limit(200)
  for (const o of stale) await transitionOrder(o.id, 'cancelled', { message: 'Plata nu a fost finalizată — comanda a expirat și stocul a fost eliberat.', notify: false }).catch((e) => console.error('[maintenance] cancel', o.id, e))
  report.expiredPayments = stale.length

  // 2. Appointment reminders, ~24 h ahead (window 20–28 h so a 15-min cron never misses one).
  const due = await db.query.appointment.findMany({
    where: and(inArray(appointment.status, ['booked', 'confirmed']), isNull(appointment.reminderSentAt), gte(appointment.startsAt, new Date(now.getTime() + 20 * 3600_000)), lt(appointment.startsAt, new Date(now.getTime() + 28 * 3600_000))),
    with: { service: true },
    limit: 200,
  })
  if (due.length) {
    const s = await getSettings()
    for (const a of due) {
      const when = `${formatDate(a.startsAt, { weekday: 'long', day: 'numeric', month: 'long' })}, ora ${formatTime(a.startsAt)}`
      const sent = await sendMail({
        to: a.email,
        subject: `Mâine: ${a.service.name} la ${s.company.brand}, ${formatTime(a.startsAt)}`,
        html: emailLayout({
          preheader: `${when} · ${s.company.address}, ${s.company.city}`,
          title: 'Ne vedem mâine',
          body: `<p><strong>${a.service.name}</strong><br>${when}</p><p>${s.company.address}, ${s.company.city}${s.company.phone ? ` · ${s.company.phone}` : ''}</p><p style="color:#4A545B">Adu ochelarii actuali și ultima rețetă, dacă le ai. Nu mai poți ajunge? Anulează din linkul de mai jos ca să eliberezi ora pentru altcineva.</p>${emailButton(`${SITE_URL}/programare/${a.manageToken}`, 'Vezi sau anulează')}`,
        }),
      })
      if (sent) await db.update(appointment).set({ reminderSentAt: now }).where(eq(appointment.id, a.id))
    }
  }
  report.reminders = due.length

  // 3. Cleanup: expired sessions / verification tokens / rate-limit buckets, stale guest carts.
  report.sessions = (await db.delete(session).where(lt(session.expiresAt, now)).returning({ id: session.id })).length
  report.verifications = (await db.delete(verification).where(lt(verification.expiresAt, now)).returning({ id: verification.id })).length
  report.rateLimits = (await db.delete(rateLimit).where(lt(rateLimit.resetAt, now)).returning({ key: rateLimit.key })).length
  report.carts = (await db.delete(cart).where(and(isNull(cart.userId), lt(cart.updatedAt, sql`now() - interval '60 days'`))).returning({ id: cart.id })).length
  return report
}
