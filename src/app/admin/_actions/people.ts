'use server'

import { randomUUID } from 'node:crypto'
import { and, eq, ne, sql } from 'drizzle-orm'
import { refresh } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { partner, session, user } from '@/lib/db/schema'
import { SITE_URL } from '@/lib/seo'
import { audit } from '@/server/audit'
import { auth } from '@/server/auth'
import { eraseCustomer } from '@/server/gdpr'
import { sendMail } from '@/server/mail'
import { emailButton, emailLayout } from '@/server/mail-templates'
import { requireStaff, type Role } from '@/server/session'

type R = { ok: boolean; message?: string; error?: string; fieldErrors?: Record<string, string> }

/** Find or create a password-less user and send the "set your password" invitation. */
async function ensureInvitedUser(email: string, name: string, role: Role) {
  const lower = email.toLowerCase()
  const existing = await db.query.user.findFirst({ where: eq(sql`lower(${user.email})`, lower) })
  if (existing) {
    if (existing.role === 'customer' && role !== 'customer') await db.update(user).set({ role, updatedAt: new Date() }).where(eq(user.id, existing.id))
    return { id: existing.id, created: false }
  }
  const id = randomUUID()
  await db.insert(user).values({ id, email: lower, name, role, emailVerified: true })
  after(() => auth.api.requestPasswordReset({ body: { email: lower, redirectTo: `${SITE_URL}/cont/resetare-parola` } }).catch((e) => console.error('invite failed', e)))
  return { id, created: true }
}

/* ── Partners ───────────────────────────────────────────────────────────── */

export async function approvePartner(id: string): Promise<R> {
  const me = await requireStaff('partners:write')
  const p = await db.query.partner.findFirst({ where: eq(partner.id, id) })
  if (!p) return { ok: false, error: 'Cererea nu există.' }
  const u = p.userId ? { id: p.userId, created: false } : await ensureInvitedUser(p.email, p.contactName, 'partner')
  if (p.userId) await db.update(user).set({ role: 'partner' }).where(and(eq(user.id, p.userId), eq(user.role, 'customer')))
  await db.update(partner).set({ status: 'approved', userId: u.id, approvedAt: new Date(), updatedAt: new Date() }).where(eq(partner.id, id))
  await audit(me, 'partner.approve', 'partner', id, { userCreated: u.created })
  after(() =>
    sendMail({
      to: p.email,
      subject: `${p.companyName}: contul de partener Sifra Vision este activ`,
      html: emailLayout({
        preheader: 'Prețuri en-gros, comenzi rapide pe SKU, facturi.',
        title: 'Bun venit printre partenerii Sifra',
        body: `<p>Am aprobat cererea pentru <strong>${p.companyName}</strong> (CUI ${p.cui}). În portal vezi prețurile en-gros, stocul în timp real și poți comanda direct pe SKU.</p>${u.created ? '<p>Separat, primești un e-mail pentru setarea parolei.</p>' : ''}${emailButton(`${SITE_URL}/b2b/portal`, 'Intră în portalul B2B')}<p style="color:#4A545B">Termen de plată: ${p.paymentTermsDays || 0} zile · Discount suplimentar: ${p.discountPercent}%</p>`,
      }),
    }),
  )
  refresh()
  return { ok: true, message: u.created ? 'Aprobat. Am creat contul și am trimis invitația.' : 'Aprobat și legat de contul existent.' }
}

export async function setPartnerStatus(id: string, status: 'rejected' | 'suspended' | 'pending' | 'approved'): Promise<R> {
  const me = await requireStaff('partners:write')
  if (status === 'approved') return approvePartner(id)
  const [p] = await db.update(partner).set({ status, updatedAt: new Date() }).where(eq(partner.id, id)).returning()
  if (!p) return { ok: false, error: 'Partenerul nu există.' }
  await audit(me, `partner.${status}`, 'partner', id)
  if (status === 'rejected') {
    after(() =>
      sendMail({
        to: p.email,
        subject: 'Cererea de parteneriat Sifra Vision',
        html: emailLayout({ preheader: p.companyName, title: 'Despre cererea ta', body: `<p>Mulțumim pentru interesul arătat. Momentan nu putem activa un cont de partener pentru ${p.companyName}. Dacă vrei să discutăm, răspunde la acest e-mail sau sună-ne.</p>` }),
      }),
    )
  }
  refresh()
  return { ok: true, message: status === 'suspended' ? 'Suspendat — accesul la portal e blocat.' : status === 'rejected' ? 'Respins.' : 'Readus în așteptare.' }
}

const terms = z.object({
  tier: z.enum(['standard', 'silver', 'gold']),
  discountPercent: z.coerce.number().int().min(0).max(40),
  paymentTermsDays: z.coerce.number().int().min(0).max(90),
  creditLimit: z.union([z.literal('').transform(() => null), z.coerce.number().min(0).max(10_000_000)]),
  internalNote: z.string().max(2000).optional(),
})

export async function savePartnerTerms(id: string, _: unknown, fd: FormData): Promise<R> {
  const me = await requireStaff('partners:write')
  const d = terms.safeParse(Object.fromEntries(fd))
  if (!d.success) return { ok: false, error: 'Verifică valorile.', fieldErrors: Object.fromEntries(d.error.issues.map((i) => [String(i.path[0]), i.message])) }
  const v = { ...d.data, creditLimit: d.data.creditLimit == null ? null : Math.round(d.data.creditLimit * 100), internalNote: d.data.internalNote || null, updatedAt: new Date() }
  await db.update(partner).set(v).where(eq(partner.id, id))
  await audit(me, 'partner.terms', 'partner', id, v)
  refresh()
  return { ok: true, message: 'Condiții salvate — se aplică la următoarea comandă.' }
}

/* ── Team ───────────────────────────────────────────────────────────────── */

const STAFF = ['staff', 'optometrist', 'manager', 'admin'] as const

export async function inviteStaff(_: unknown, fd: FormData): Promise<R> {
  const me = await requireStaff('users:write')
  const d = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email('E-mail invalid'), role: z.enum(STAFF) }).safeParse(Object.fromEntries(fd))
  if (!d.success) return { ok: false, error: 'Verifică datele.', fieldErrors: Object.fromEntries(d.error.issues.map((i) => [String(i.path[0]), i.message])) }
  const u = await ensureInvitedUser(d.data.email, d.data.name, d.data.role)
  if (!u.created) await db.update(user).set({ role: d.data.role, updatedAt: new Date() }).where(eq(user.id, u.id))
  await audit(me, 'user.invite', 'user', u.id, { role: d.data.role })
  refresh()
  return { ok: true, message: u.created ? `Invitație trimisă la ${d.data.email}.` : `${d.data.email} avea deja cont — rolul a fost actualizat.` }
}

export async function setUserRole(id: string, role: Role): Promise<R> {
  const me = await requireStaff('users:write')
  if (id === me.id) return { ok: false, error: 'Nu îți poți schimba propriul rol.' }
  if (![...STAFF, 'customer'].includes(role as never)) return { ok: false, error: 'Rol invalid.' }
  if (role !== 'admin') {
    const admins = await db.select({ n: sql<number>`count(*)::int` }).from(user).where(and(eq(user.role, 'admin'), ne(user.id, id)))
    if ((admins[0]?.n ?? 0) === 0) return { ok: false, error: 'Trebuie să rămână cel puțin un administrator.' }
  }
  await db.update(user).set({ role, updatedAt: new Date() }).where(eq(user.id, id))
  await db.delete(session).where(eq(session.userId, id)) // new permissions on next sign-in
  await audit(me, 'user.role', 'user', id, { role })
  refresh()
  return { ok: true, message: role === 'customer' ? 'Acces la administrare revocat.' : 'Rol actualizat. Utilizatorul se reconectează.' }
}

export async function revokeSessions(id: string): Promise<R> {
  const me = await requireStaff('users:write')
  await db.delete(session).where(eq(session.userId, id))
  await audit(me, 'user.sessions.revoke', 'user', id)
  refresh()
  return { ok: true, message: 'Toate sesiunile au fost închise.' }
}

/* ── Customers (GDPR) ───────────────────────────────────────────────────── */

export async function eraseCustomerAccount(id: string): Promise<R> {
  const me = await requireStaff('reports:read')
  const ok = await eraseCustomer(id)
  if (!ok) return { ok: false, error: 'Contul nu poate fi șters pe această cale (cont de echipă sau inexistent).' }
  await audit(me, 'gdpr.erase', 'user', id)
  refresh()
  return { ok: true, message: 'Cont șters. Comenzile rămân în evidența contabilă, fără legătură cu contul.' }
}

export async function changeRoleForm(id: string, _: unknown, fd: FormData): Promise<R> {
  return setUserRole(id, String(fd.get('role')) as Role)
}
