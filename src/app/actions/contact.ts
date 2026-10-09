'use server'

import { after } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { inquiry } from '@/lib/db/schema'
import { sendMail, staffInbox } from '@/server/mail'
import { emailLayout } from '@/server/mail-templates'
import { rateLimit } from '@/server/rate-limit'

const schema = z.object({
  name: z.string().trim().min(2, 'Spune-ne cum te numești.').max(80),
  email: z.email('E-mail invalid.'),
  phone: z.string().trim().max(30).optional(),
  subject: z.string().trim().max(120).optional(),
  orderNumber: z.string().trim().max(30).optional(),
  message: z.string().trim().min(10, 'Mesajul e prea scurt.').max(3000),
})

export async function sendContact(_: unknown, formData: FormData): Promise<{ ok: boolean; message: string; fieldErrors?: Record<string, string> }> {
  if (formData.get('hp')) return { ok: true, message: 'Mulțumim!' }
  if (!(await rateLimit('contact', 5, 3600))) return { ok: false, message: 'Prea multe mesaje. Revino mai târziu sau sună-ne.' }
  const parsed = schema.safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => v !== '')))
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message
    return { ok: false, message: 'Verifică câmpurile.', fieldErrors }
  }
  const d = parsed.data
  await db.insert(inquiry).values({ kind: 'contact', ...d })
  after(async () => {
    const staff = staffInbox()
    if (staff) await sendMail({ to: staff, replyTo: d.email, subject: `Mesaj: ${d.subject ?? 'contact'} — ${d.name}`, html: emailLayout({ preheader: d.email, title: d.subject ?? 'Mesaj nou', body: `<p>${d.name} · ${d.email}${d.phone ? ` · ${d.phone}` : ''}${d.orderNumber ? ` · comanda ${d.orderNumber}` : ''}</p><p style="white-space:pre-wrap">${d.message.replace(/</g, '&lt;')}</p>` }) })
  })
  return { ok: true, message: 'Mulțumim! Îți răspundem în cel mult o zi lucrătoare.' }
}
