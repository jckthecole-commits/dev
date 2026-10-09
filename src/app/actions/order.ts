'use server'

import { and, eq } from 'drizzle-orm'
import { refresh } from 'next/cache'
import { after } from 'next/server'
import { db } from '@/lib/db'
import { order, orderEvent, orderItem, prescription } from '@/lib/db/schema'
import { sendMail, staffInbox } from '@/server/mail'
import { emailLayout } from '@/server/mail-templates'
import { getAccessibleOrder } from '@/server/order-access'
import { rateLimit } from '@/server/rate-limit'
import { storePrivateFile } from '@/server/storage'

/** Customer uploads the prescription after ordering ("trimit mai târziu"). */
export async function uploadOrderRx(_: unknown, formData: FormData): Promise<{ ok: boolean; message: string }> {
  if (!(await rateLimit('order:rx', 10, 600))) return { ok: false, message: 'Prea multe încercări.' }
  const number = String(formData.get('number') ?? '')
  const token = String(formData.get('token') ?? '')
  const itemId = String(formData.get('itemId') ?? '')
  const file = formData.get('file')
  const o = await getAccessibleOrder(number, token || undefined)
  if (!o) return { ok: false, message: 'Comanda nu a fost găsită.' }
  const item = o.items.find((i) => i.id === itemId)
  if (!item) return { ok: false, message: 'Produsul nu face parte din comandă.' }
  if (!(file instanceof File) || !file.size) return { ok: false, message: 'Alege o poză sau un PDF.' }
  try {
    const stored = await storePrivateFile(file, 'rx')
    const [rx] = await db.insert(prescription).values({ userId: o.userId, source: 'upload', fileKey: stored.key, fileMime: stored.mime, status: 'pending' }).returning({ id: prescription.id })
    await db
      .update(orderItem)
      .set({ prescriptionId: rx!.id, configuration: { ...(item.configuration ?? { lensType: 'single', treatments: [] }), rxMode: 'upload', prescriptionId: rx!.id } })
      .where(and(eq(orderItem.id, item.id), eq(orderItem.orderId, o.id)))
    await db.insert(orderEvent).values({ orderId: o.id, kind: 'rx', message: 'Rețeta a fost încărcată de client', public: true })
    if (o.status === 'placed' || o.status === 'on_hold') await db.update(order).set({ status: 'rx_review' }).where(eq(order.id, o.id))
    const staff = staffInbox()
    if (staff) after(() => sendMail({ to: staff, subject: `Rețetă încărcată · ${o.number}`, html: emailLayout({ preheader: o.customerName, title: `Rețetă nouă pentru ${o.number}`, body: `<p>${o.customerName} a încărcat rețeta pentru ${item.productName}. Verific-o în admin → Rețete.</p>` }) }))
    refresh()
    return { ok: true, message: 'Mulțumim! Optometristul verifică rețeta.' }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Încărcarea a eșuat.' }
  }
}
