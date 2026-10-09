import { asc, desc, eq, sql } from 'drizzle-orm'
import Link from 'next/link'
import { Suspense } from 'react'
import { deleteFaq, saveFaq } from '@/app/admin/_actions/content'
import { ActionButton } from '@/components/admin/action-button'
import { AdminForm } from '@/components/admin/form'
import { Badge, Empty, Field, input, PageHeader, Panel, Table } from '@/components/admin/ui'
import { Icon } from '@/components/icons'
import { db } from '@/lib/db'
import { faq, post } from '@/lib/db/schema'
import { formatDate } from '@/lib/format'
import { can, requireStaff } from '@/server/session'

export const metadata = { title: 'Pagini & jurnal' }

export default function Content({ searchParams }: Pick<PageProps<'/admin/continut'>, 'searchParams'>) {
  return (
    <Suspense fallback={<div className="skeleton h-[600px]" />}>
      <List searchParams={searchParams} />
    </Suspense>
  )
}

async function List({ searchParams }: Pick<PageProps<'/admin/continut'>, 'searchParams'>) {
  const me = await requireStaff('orders:read')
  const writable = can(me.role, 'content:write')
  const sp = await searchParams
  const tip = sp.tip === 'page' ? 'page' : sp.tip === 'faq' ? 'faq' : 'article'
  const counts = await db.select({ kind: post.kind, n: sql<number>`count(*)::int` }).from(post).groupBy(post.kind)
  const faqCount = await db.select({ n: sql<number>`count(*)::int` }).from(faq)
  const tabs: [string, string, number][] = [
    ['article', 'Jurnal & ghiduri', counts.find((c) => c.kind === 'article')?.n ?? 0],
    ['page', 'Pagini', counts.find((c) => c.kind === 'page')?.n ?? 0],
    ['faq', 'Întrebări frecvente', faqCount[0]?.n ?? 0],
  ]
  return (
    <>
      <PageHeader eyebrow="Conținut" title="Pagini & jurnal" actions={writable && tip !== 'faq' ? <Link href={`/admin/continut/nou?tip=${tip}`} className="btn btn-primary btn-sm"><Icon name="plus" size={16} /> {tip === 'page' ? 'Pagină nouă' : 'Articol nou'}</Link> : null} />
      <nav aria-label="Tip conținut" className="mb-6 flex flex-wrap gap-2">
        {tabs.map(([k, l, n]) => <Link key={k} href={`/admin/continut?tip=${k}`} aria-current={tip === k ? 'page' : undefined} className="tab-pill">{l} <span className="ml-1 font-mono text-[12px] opacity-70">{n}</span></Link>)}
      </nav>
      {tip === 'faq' ? <Faqs writable={writable} /> : <Posts kind={tip} />}
    </>
  )
}

async function Posts({ kind }: { kind: 'article' | 'page' }) {
  const rows = await db.select({ id: post.id, slug: post.slug, title: post.title, status: post.status, category: post.category, updatedAt: post.updatedAt, publishedAt: post.publishedAt, readingMinutes: post.readingMinutes }).from(post).where(eq(post.kind, kind)).orderBy(desc(post.updatedAt))
  return (
    <Panel pad={false}>
      {rows.length ? (
        <Table>
          <thead><tr><th>Titlu</th>{kind === 'article' ? <th>Categorie</th> : null}<th>Status</th><th>Actualizat</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/admin/continut/${p.id}`} className="font-bold text-ink no-underline hover:underline">{p.title}</Link><div className="spec">{kind === 'article' ? `/jurnal/${p.slug}` : `/${p.slug}`}{p.readingMinutes ? ` · ${p.readingMinutes} min` : ''}</div></td>
                {kind === 'article' ? <td className="text-[13.5px]">{p.category ?? '—'}</td> : null}
                <td><Badge tone={p.status === 'published' ? 'ok' : 'warn'}>{p.status === 'published' ? 'publicat' : 'ciornă'}</Badge></td>
                <td className="text-[13.5px]">{formatDate(p.updatedAt, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty icon="file" title="Nimic scris încă" />
      )}
    </Panel>
  )
}

async function Faqs({ writable }: { writable: boolean }) {
  const rows = await db.select().from(faq).orderBy(asc(faq.topic), asc(faq.position))
  const topics = [...new Set(rows.map((r) => r.topic))]
  const fields = (f?: (typeof rows)[number]) => (
    <div className="grid w-full gap-3 sm:grid-cols-[1fr_160px_90px]">
      <Field label="Întrebare"><input name="question" defaultValue={f?.question} className={input} /></Field>
      <Field label="Subiect"><input name="topic" defaultValue={f?.topic ?? 'general'} list="faq-topics" className={input} /></Field>
      <Field label="Ordine"><input name="position" type="number" min={0} defaultValue={f?.position ?? rows.length} className={input} /></Field>
      <Field label="Răspuns" className="sm:col-span-3"><textarea name="answer" defaultValue={f?.answer} rows={3} className="field h-auto py-2.5 text-[14px]" /></Field>
      <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" name="active" defaultChecked={f?.active ?? true} className="size-4 accent-cobalt" /> Afișată pe site</label>
    </div>
  )
  return (
    <div className="flex flex-col gap-6">
      <datalist id="faq-topics">{topics.map((t) => <option key={t} value={t} />)}</datalist>
      {writable ? <Panel title="Întrebare nouă"><AdminForm action={saveFaq.bind(null, null)} submit="Adaugă">{fields()}</AdminForm></Panel> : null}
      <Panel pad={false}>
        <p className="border-b border-line-soft px-5 py-3 text-[13.5px] text-graphite">Apar pe /intrebari-frecvente, grupate pe subiect, și în datele structurate FAQPage pentru Google.</p>
        <ul className="divide-y divide-line-soft">
          {rows.map((f) => (
            <li key={f.id} className="px-5 py-4">
              <details>
                <summary className="flex cursor-pointer items-center justify-between gap-3">
                  <span><span className="font-bold">{f.question}</span> <span className="ml-1 font-mono text-[11.5px] text-graphite">{f.topic}</span> {f.active ? null : <Badge tone="warn">ascunsă</Badge>}</span>
                  {writable ? <ActionButton action={deleteFaq.bind(null, f.id)} variant="ghost" confirm="Ștergi întrebarea?"><Icon name="trash" size={14} /></ActionButton> : null}
                </summary>
                <div className="mt-3">{writable ? <AdminForm action={saveFaq.bind(null, f.id)}>{fields(f)}</AdminForm> : <p className="text-[14px]">{f.answer}</p>}</div>
              </details>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
