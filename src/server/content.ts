import 'server-only'
import { and, asc, desc, eq } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/lib/db'
import { document, faq, post } from '@/lib/db/schema'
import { formatPrice } from '@/lib/format'
import { interpolate } from '@/lib/markdown'
import { getLensCatalog } from './catalog'
import { getSettings } from './settings'

export async function getPublishedPosts(kind: 'article' | 'page' = 'article') {
  'use cache'
  cacheTag('posts')
  cacheLife('hours')
  return db
    .select({ id: post.id, slug: post.slug, title: post.title, excerpt: post.excerpt, category: post.category, readingMinutes: post.readingMinutes, publishedAt: post.publishedAt, updatedAt: post.updatedAt, coverKey: post.coverKey })
    .from(post)
    .where(and(eq(post.kind, kind), eq(post.status, 'published')))
    .orderBy(desc(post.publishedAt))
}

export async function getPost(slug: string, kind?: 'article' | 'page') {
  'use cache'
  cacheTag('posts', `post:${slug}`)
  cacheLife('hours')
  const row = await db.query.post.findFirst({ where: and(eq(post.slug, slug), eq(post.status, 'published'), kind ? eq(post.kind, kind) : undefined) })
  if (!row) return null
  return { ...row, body: await resolvePlaceholders(row.body) }
}

export async function getFaqs(topic?: string) {
  'use cache'
  cacheTag('faqs')
  cacheLife('hours')
  return db
    .select({ id: faq.id, question: faq.question, answer: faq.answer, topic: faq.topic })
    .from(faq)
    .where(topic ? and(eq(faq.active, true), eq(faq.topic, topic)) : eq(faq.active, true))
    .orderBy(asc(faq.position))
}

/** Legal & guide pages embed live settings: {{policies.returnDays}}, {{shipping.freeThreshold}}… */
async function resolvePlaceholders(body: string) {
  if (!body.includes('{{')) return body
  const [s, lenses] = await Promise.all([getSettings(), getLensCatalog()])
  const ship = (m: { price: number; label: string; eta: string }) => ({ ...m, price: m.price ? formatPrice(m.price) : 'gratuit' })
  const ctx = {
    company: { ...s.company, phoneSuffix: s.company.phone ? `, ${s.company.phone}` : '' },
    policies: s.policies,
    shipping: {
      freeThreshold: formatPrice(s.shipping.freeThreshold),
      courier: ship(s.shipping.courier),
      easybox: ship(s.shipping.easybox),
      pickup: ship(s.shipping.pickup),
    },
    price: Object.fromEntries(lenses.treatments.map((t) => [t.code, formatPrice(t.price)])),
  }
  return interpolate(body, ctx)
}

/** Documents anyone may download (declarations of conformity, certificates). */
export async function getPublicDocuments() {
  'use cache'
  cacheTag('documents')
  cacheLife('hours')
  return db.select({ id: document.id, title: document.title, kind: document.kind, size: document.size }).from(document).where(eq(document.audience, 'public')).orderBy(asc(document.title))
}
