'use server'

import { and, eq, ne } from 'drizzle-orm'
import { refresh, updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { faq, post } from '@/lib/db/schema'
import { plainText, slugify } from '@/lib/text'
import { audit } from '@/server/audit'
import { requireStaff } from '@/server/session'
import { deleteObject, storePublicFile } from '@/server/storage'

type R = { ok: boolean; message?: string; error?: string; fieldErrors?: Record<string, string> }
const RESERVED = new Set(['admin', 'api', 'cont', 'cos', 'checkout', 'comanda', 'rame', 'rame-de-vedere', 'ochelari-de-soare', 'jurnal', 'ghid', 'b2b', 'programare', 'proba-virtuala', 'cautare', 'favorite', 'media', 'feeds', 'plata', 'contact', 'lentile', 'newsletter', 'conformitate', 'showroom-galati', 'intrebari-frecvente'])

const postInput = z.object({
  kind: z.enum(['article', 'page']),
  title: z.string().trim().min(3, 'Titlul e prea scurt').max(140),
  slug: z.string().trim().max(90).optional(),
  excerpt: z.string().trim().max(300).optional(),
  body: z.string().min(20, 'Conținutul e prea scurt').max(60000),
  category: z.string().trim().max(40).optional(),
  authorName: z.string().trim().max(80).optional(),
  status: z.enum(['draft', 'published']),
  metaTitle: z.string().trim().max(90).optional(),
  metaDescription: z.string().trim().max(200).optional(),
})

export async function savePost(id: string | null, _: unknown, fd: FormData): Promise<R> {
  const me = await requireStaff('content:write')
  const d = postInput.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === 'string')))
  if (!d.success) return { ok: false, error: 'Verifică câmpurile.', fieldErrors: Object.fromEntries(d.error.issues.map((i) => [String(i.path[0]), i.message])) }
  const p = d.data
  const slug = slugify(p.slug || p.title)
  if (!slug) return { ok: false, error: 'Adresă invalidă.', fieldErrors: { slug: 'Adresă invalidă' } }
  if (p.kind === 'page' && RESERVED.has(slug)) return { ok: false, error: `/${slug} este rezervat de site.`, fieldErrors: { slug: 'Adresă rezervată' } }
  const clash = await db.query.post.findFirst({ where: and(eq(post.slug, slug), id ? ne(post.id, id) : undefined), columns: { id: true } })
  if (clash) return { ok: false, error: `Adresa ${slug} e folosită deja.`, fieldErrors: { slug: 'Adresă folosită' } }
  const words = plainText(p.body).split(/\s+/).filter(Boolean).length
  const prev = id ? await db.query.post.findFirst({ where: eq(post.id, id) }) : null
  let coverKey = prev?.coverKey ?? null
  const cover = fd.get('cover')
  if (cover instanceof File && cover.size > 0) {
    try {
      coverKey = (await storePublicFile(cover, 'posts')).key
      if (prev?.coverKey) await deleteObject(prev.coverKey).catch(() => {})
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Imaginea nu a putut fi încărcată.' }
    }
  }
  if (fd.get('removeCover') === 'on' && coverKey) {
    await deleteObject(coverKey).catch(() => {})
    coverKey = null
  }
  const values = {
    kind: p.kind,
    slug,
    title: p.title,
    excerpt: p.excerpt || null,
    body: p.body,
    category: p.kind === 'article' ? p.category || null : null,
    authorName: p.authorName || null,
    readingMinutes: p.kind === 'article' ? Math.max(1, Math.round(words / 200)) : null,
    status: p.status,
    metaTitle: p.metaTitle || null,
    metaDescription: p.metaDescription || p.excerpt || null,
    coverKey,
    publishedAt: p.status === 'published' ? (prev?.publishedAt ?? new Date()) : (prev?.publishedAt ?? null),
    updatedAt: new Date(),
  }
  let newId = id
  if (id) await db.update(post).set(values).where(eq(post.id, id))
  else newId = (await db.insert(post).values(values).returning({ id: post.id }))[0]!.id
  await audit(me, id ? 'post.update' : 'post.create', 'post', newId, { slug, status: p.status })
  updateTag('posts')
  updateTag(`post:${slug}`)
  if (prev && prev.slug !== slug) updateTag(`post:${prev.slug}`)
  if (!id) redirect(`/admin/continut/${newId}`)
  refresh()
  return { ok: true, message: p.status === 'published' ? 'Publicat.' : 'Salvat ca ciornă.' }
}

export async function deletePost(id: string): Promise<R> {
  const me = await requireStaff('content:write')
  const [p] = await db.delete(post).where(eq(post.id, id)).returning()
  if (!p) return { ok: false, error: 'Nu există.' }
  if (p.coverKey) await deleteObject(p.coverKey).catch(() => {})
  await audit(me, 'post.delete', 'post', id, { slug: p.slug, title: p.title })
  updateTag('posts')
  updateTag(`post:${p.slug}`)
  redirect(`/admin/continut?tip=${p.kind}`)
}

const faqInput = z.object({
  question: z.string().trim().min(5).max(200),
  answer: z.string().trim().min(5).max(3000),
  topic: z.string().trim().min(2).max(30),
  position: z.coerce.number().int().min(0).max(999),
  active: z.literal('on').optional(),
})

export async function saveFaq(id: string | null, _: unknown, fd: FormData): Promise<R> {
  const me = await requireStaff('content:write')
  const d = faqInput.safeParse(Object.fromEntries(fd))
  if (!d.success) return { ok: false, error: 'Completează întrebarea și răspunsul.', fieldErrors: Object.fromEntries(d.error.issues.map((i) => [String(i.path[0]), i.message])) }
  const v = { ...d.data, active: d.data.active === 'on', updatedAt: new Date() }
  if (id) await db.update(faq).set(v).where(eq(faq.id, id))
  else await db.insert(faq).values(v)
  await audit(me, id ? 'faq.update' : 'faq.create', 'faq', id)
  updateTag('faqs')
  refresh()
  return { ok: true, message: id ? 'Salvat.' : 'Întrebare adăugată.' }
}

export async function deleteFaq(id: string): Promise<R> {
  const me = await requireStaff('content:write')
  await db.delete(faq).where(eq(faq.id, id))
  await audit(me, 'faq.delete', 'faq', id)
  updateTag('faqs')
  refresh()
  return { ok: true }
}
