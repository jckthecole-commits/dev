import { desc, eq, sql } from 'drizzle-orm'
import Link from 'next/link'
import { Suspense } from 'react'
import { moderateReview, replyReview } from '@/app/admin/_actions/catalog-extra'
import { ActionButton } from '@/components/admin/action-button'
import { AdminForm } from '@/components/admin/form'
import { Badge, Empty, PageHeader, Panel } from '@/components/admin/ui'
import { db } from '@/lib/db'
import { product, review } from '@/lib/db/schema'
import { formatDateTime } from '@/lib/format'
import { can, requireStaff } from '@/server/session'

export const metadata = { title: 'Recenzii' }

const TABS = [
  { key: 'pending', label: 'De moderat' },
  { key: 'approved', label: 'Publicate' },
  { key: 'rejected', label: 'Respinse' },
] as const
const FIT: Record<string, string> = { narrow: 'mică pe față', true: 'pe măsură', wide: 'lată' }

export default function Reviews({ searchParams }: Pick<PageProps<'/admin/recenzii'>, 'searchParams'>) {
  return (
    <Suspense fallback={<div className="skeleton h-[500px]" />}>
      <List searchParams={searchParams} />
    </Suspense>
  )
}

async function List({ searchParams }: Pick<PageProps<'/admin/recenzii'>, 'searchParams'>) {
  const me = await requireStaff('orders:read')
  const writable = can(me.role, 'content:write')
  const sp = await searchParams
  const tab = TABS.find((t) => t.key === sp.status)?.key ?? 'pending'
  const [rows, counts] = await Promise.all([
    db.select({ r: review, product: product.name, slug: product.slug }).from(review).innerJoin(product, eq(product.id, review.productId)).where(eq(review.status, tab)).orderBy(desc(review.createdAt)).limit(60),
    db.select({ status: review.status, n: sql<number>`count(*)::int` }).from(review).groupBy(review.status),
  ])
  return (
    <>
      <PageHeader eyebrow="Catalog" title="Recenzii">
        <p className="mt-2 max-w-2xl text-[14.5px] text-graphite">Publicăm toate recenziile autentice, inclusiv pe cele negative (cerință Omnibus / ANPC). Respinge doar spam-ul, limbajul ofensator sau datele personale.</p>
      </PageHeader>
      <nav aria-label="Filtru status" className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/recenzii?status=${t.key}`} aria-current={t.key === tab ? 'page' : undefined} className="tab-pill">
            {t.label} <span className="ml-1 font-mono text-[12px] opacity-70">{counts.find((c) => c.status === t.key)?.n ?? 0}</span>
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <Panel><Empty icon="star" title="Nicio recenzie aici" /></Panel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {rows.map(({ r, product: pname, slug }) => (
            <Panel key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span aria-label={`${r.rating} din 5 stele`} className="font-mono text-[15px] tracking-[0.1em] text-ink">{'★'.repeat(r.rating)}<span className="text-line">{'★'.repeat(5 - r.rating)}</span></span>
                    {r.verifiedPurchase ? <Badge tone="ok">cumpărare verificată</Badge> : <Badge>neverificat</Badge>}
                  </div>
                  <div className="mt-1 text-[13.5px]"><strong>{r.name}</strong>{r.city ? `, ${r.city}` : ''} · <Link href={`/rame/${slug}#recenzii`} target="_blank" className="text-cobalt">{pname}</Link></div>
                </div>
                <span className="spec">{formatDateTime(r.createdAt)}</span>
              </div>
              {r.title ? <div className="mt-3 font-bold">{r.title}</div> : null}
              <p className="mt-1 whitespace-pre-wrap text-[14.5px] leading-relaxed">{r.body}</p>
              {r.fit ? <p className="mt-2 text-[13px] text-graphite">Mărime: {FIT[r.fit] ?? r.fit}</p> : null}
              {writable ? (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {r.status !== 'approved' ? <ActionButton action={moderateReview.bind(null, r.id, 'approved')} variant="primary">Publică</ActionButton> : null}
                    {r.status !== 'rejected' ? <ActionButton action={moderateReview.bind(null, r.id, 'rejected')} variant="ghost">Respinge</ActionButton> : null}
                    {r.status !== 'pending' ? <ActionButton action={moderateReview.bind(null, r.id, 'pending')} variant="ghost">În așteptare</ActionButton> : null}
                  </div>
                  <details className="mt-3" open={!!r.reply}>
                    <summary className="cursor-pointer text-[13.5px] font-bold text-cobalt">{r.reply ? 'Răspunsul Sifra' : 'Răspunde public'}</summary>
                    <div className="mt-2">
                      <AdminForm action={replyReview.bind(null, r.id)} submit="Publică răspunsul">
                        <textarea name="reply" rows={3} defaultValue={r.reply ?? ''} className="field h-auto py-2.5 text-[14px]" aria-label="Răspuns" placeholder={`Mulțumim, ${r.name.split(' ')[0]}!`} />
                      </AdminForm>
                    </div>
                  </details>
                </>
              ) : r.reply ? <p className="mt-3 rounded-xl bg-fog p-3 text-[13.5px]">↳ {r.reply}</p> : null}
            </Panel>
          ))}
        </div>
      )}
    </>
  )
}
