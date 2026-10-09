import { desc, eq, sql } from 'drizzle-orm'
import Link from 'next/link'
import { Suspense } from 'react'
import { setInquiryStatus } from '@/app/admin/_actions/agenda'
import { ActionButton } from '@/components/admin/action-button'
import { Badge, Empty, PageHeader, Panel } from '@/components/admin/ui'
import { db } from '@/lib/db'
import { inquiry, order } from '@/lib/db/schema'
import { formatDateTime } from '@/lib/format'
import { formatPhone } from '@/lib/ro'
import { requireStaff } from '@/server/session'

export const metadata = { title: 'Mesaje' }

const KIND: Record<string, string> = { contact: 'Contact', callback: 'Sună-mă', return: 'Retur', b2b: 'B2B' }
const TABS = [
  { key: 'new', label: 'Noi' },
  { key: 'open', label: 'În lucru' },
  { key: 'closed', label: 'Închise' },
] as const

export default function Inbox({ searchParams }: Pick<PageProps<'/admin/mesaje'>, 'searchParams'>) {
  return (
    <Suspense fallback={<div className="skeleton h-[480px]" />}>
      <List searchParams={searchParams} />
    </Suspense>
  )
}

async function List({ searchParams }: Pick<PageProps<'/admin/mesaje'>, 'searchParams'>) {
  await requireStaff('orders:read')
  const sp = await searchParams
  const tab = TABS.find((t) => t.key === sp.status)?.key ?? 'new'
  const [rows, counts] = await Promise.all([
    db.select({ m: inquiry, orderId: order.id }).from(inquiry).leftJoin(order, eq(order.number, inquiry.orderNumber)).where(eq(inquiry.status, tab)).orderBy(desc(inquiry.createdAt)).limit(100),
    db.select({ status: inquiry.status, n: sql<number>`count(*)::int` }).from(inquiry).groupBy(inquiry.status),
  ])
  return (
    <>
      <PageHeader eyebrow="Operațiuni" title="Mesaje" />
      <nav aria-label="Filtru status" className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/mesaje?status=${t.key}`} aria-current={t.key === tab ? 'page' : undefined} className="tab-pill">
            {t.label} <span className="ml-1 font-mono text-[12px] opacity-70">{counts.find((c) => c.status === t.key)?.n ?? 0}</span>
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <Panel><Empty icon="inbox" title="Inbox gol">{tab === 'new' ? 'Mesajele din formularul de contact, cererile „Sună-mă” și retururile apar aici.' : undefined}</Empty></Panel>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map(({ m, orderId }) => (
            <Panel key={m.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{m.name}</span>
                    <Badge tone={m.kind === 'return' ? 'warn' : m.kind === 'callback' ? 'info' : 'neutral'}>{KIND[m.kind] ?? m.kind}</Badge>
                    {m.orderNumber ? orderId ? <Link href={`/admin/comenzi/${orderId}`} className="font-mono text-[13px] text-cobalt">{m.orderNumber}</Link> : <span className="font-mono text-[13px]">{m.orderNumber}</span> : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 text-[13.5px]">
                    {m.email ? <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject ?? 'mesajul tău către Sifra Vision'}`)}`} className="text-cobalt">{m.email}</a> : null}
                    {m.phone ? <a href={`tel:${m.phone}`}>{formatPhone(m.phone)}</a> : null}
                  </div>
                </div>
                <span className="spec">{formatDateTime(m.createdAt)}</span>
              </div>
              {m.subject ? <div className="mt-3 font-bold">{m.subject}</div> : null}
              <p className="mt-1 whitespace-pre-wrap text-[14.5px] leading-relaxed">{m.message}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {m.status !== 'open' ? <ActionButton action={setInquiryStatus.bind(null, m.id, 'open')} variant={m.status === 'new' ? 'primary' : 'ghost'}>{m.status === 'new' ? 'Preiau' : 'Redeschide'}</ActionButton> : null}
                {m.status !== 'closed' ? <ActionButton action={setInquiryStatus.bind(null, m.id, 'closed')} variant="secondary">Rezolvat</ActionButton> : null}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  )
}
