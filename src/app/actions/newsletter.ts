'use server'

import { eq } from 'drizzle-orm'
import { after } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { subscriber } from '@/lib/db/schema'
import { randomToken } from '@/lib/crypto'
import { sendMail } from '@/server/mail'
import { emailButton, emailLayout } from '@/server/mail-templates'
import { rateLimit } from '@/server/rate-limit'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export async function subscribe(_: unknown, formData: FormData): Promise<{ ok: boolean; message: string }> {
  if (formData.get('company')) return { ok: true, message: 'Mulțumim!' } // honeypot
  if (!(await rateLimit('newsletter', 5, 600))) return { ok: false, message: 'Prea multe încercări. Revino mai târziu.' }
  const parsed = z.email().safeParse(String(formData.get('email') ?? '').trim().toLowerCase())
  if (!parsed.success) return { ok: false, message: 'Adresa de e-mail nu pare corectă.' }
  const email = parsed.data
  const existing = await db.query.subscriber.findFirst({ where: eq(subscriber.email, email) })
  if (existing?.confirmedAt && !existing.unsubscribedAt) return { ok: true, message: 'Ești deja abonat. Mulțumim!' }
  const token = randomToken()
  if (existing) await db.update(subscriber).set({ confirmToken: token, unsubscribedAt: null }).where(eq(subscriber.id, existing.id))
  else await db.insert(subscriber).values({ email, source: String(formData.get('source') ?? 'footer'), confirmToken: token })
  after(() =>
    sendMail({
      to: email,
      subject: 'Confirmă abonarea la Sifra Vision',
      html: emailLayout({
        preheader: 'Un singur click și ești abonat.',
        title: 'Confirmă abonarea',
        body: `<p>Mai e un pas: confirmă că vrei să primești noutățile Sifra Vision (maximum un e-mail pe lună).</p>${emailButton(`${SITE}/newsletter/confirmare?t=${token}`, 'Confirm abonarea')}<p style="color:#4A545B">Dacă nu ai cerut tu, ignoră mesajul.</p>`,
      }),
    }),
  )
  return { ok: true, message: 'Ți-am trimis un e-mail de confirmare.' }
}
