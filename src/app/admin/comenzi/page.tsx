import { and, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm'
import Link from 'next/link'
import { Suspense } from 'react'
import { Badge, Empty, PageHeader, Pagination, Panel, Table } from '@/components/admin/ui'
import { Icon } from '@/components/icons'
import { db } from '@/lib/db'
import { order } from '@/lib/db/schema'
import { formatDateTime, formatPrice } from '@/lib/format'
import { PAYMENT_LABEL, SHIPPING_LABEL, STATUS, type OrderStatus } from '@/lib/order-status'
import { requireStaff } from '@/server/session'

export const metadata = { title: 'Comenzi' }
const PER = 30
const OPEN: OrderStatus[] = ['pending_payment', 'placed', 'rx_review', 'on_hold', 'in_lab', 'qc', 'ready']

export default function OrdersPage({ searchParams }: Pick<PageProps<'/admin/comenzi'>, 'searchParams'>) {
  return (
    <Suspense fallback={<div className="skeleton h-96" />}>
      <Orders searchParams={searchParams} />
    </Suspense>
  )
}

async function Orders({ searchParams }: Pick<PageProps<'/admin/comenzi'>, 'searchParams'>) {
  await requireStaff('orders:read')
  const sp = await searchParams
  const s = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '')
  const status = s('status')
  const q = s('q').trim()
  const channel = s('canal')
  const page = Math.max(1, Number(s('pagina')) || 1)
  const where: SQL[] = []
  if (status === 'deschise') where.push(inArray(order.status, OPEN))
  else if (status && status in STATUS) where.push(eq(order.status, status as OrderStatus))
  if (channel === 'b2b' || channel === 'b2c') where.push(eq(order.channel, channel))
  if (q) where.push(or(ilike(order.number, `%${q}%`), ilike(order.customerName, `%${q}%`), ilike(order.email, `%${q}%`), ilike(order.phone, `%${q.replace(/\s/g, '')}%`), ilike(order.awb, `%${q}%`))!)
  const cond = where.length ? and(...where) : undefined
  const [rows, total, counts] = await Promise.all([
    db.select().from(order).where(cond).orderBy(desc(order.createdAt)).limit(PER).offset((page - 1) * PER),
    db.select({ n: sql<number>`count(*)::int` }).from(order).where(cond),
    db.select({ status: order.status, n: sql<number>`count(*)::int` }).from(order).groupBy(order.status),
  ])
  const pages = Math.ceil((total[0]?.n ?? 0) / PER)
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(status && { status }), ...(q && { q }), ...(channel && { canal: channel }), ...patch })
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k)
    const str = p.toString()
    return `/admin/comenzi${str ? `?${str}` : ''}`
  }
  const tabs: [string, string, number][] = [
    ['', 'Toate', counts.reduce((a, c) => a + c.n, 0)],
    ['deschise', 'Deschise', counts.filter((c) => OPEN.includes(c.status)).reduce((a, c) => a + c.n, 0)],
    ['rx_review', 'Verificare rețetă', counts.find((c) => c.status === 'rx_review')?.n ?? 0],
    ['on_hold', 'Clarificări', counts.find((c) => c.status === 'on_hold')?.n ?? 0],
    ['in_lab', 'Laborator', counts.find((c) => c.status === 'in_lab')?.n ?? 0],
    ['ready', 'Gata', counts.find((c) => c.status === 'ready')?.n ?? 0],
    ['shipped', 'Expediate', counts.find((c) => c.status === 'shipped')?.n ?? 0],
  ]
  return (
    <>
      <PageHeader title="Comenzi" eyebrow="Operațiuni" actions={<a href="/api/private/orders-export" className="btn btn-secondary btn-sm"><Icon name="download" size={16} /> Export CSV</a>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tabs.map(([v, label, n]) => (
          <Link key={v || 'all'} href={qs({ status: v, pagina: '' })} aria-current={status === v ? 'page' : undefined} className="tab-pill">
            {label} <span className="ml-1 font-mono text-[12px] opacity-70">{n}</span>
          </Link>
        ))}
      </div>
      <Panel pad={false}>
        <form className="flex flex-wrap items-center gap-2 border-b border-line-soft p-3">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <div className="relative flex-1">
            <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite" />
            <input name="q" defaultValue={q} placeholder="Număr, nume, e-mail, telefon, AWB…" className="field h-10 pl-10 text-[14px]" aria-label="Caută comenzi" />
          </div>
          <select name="canal" defaultValue={channel} className="field h-10 w-auto text-[14px]" aria-label="Canal">
            <option value="">Toate canalele</option>
            <option value="b2c">Online (B2C)</option>
            <option value="b2b">Parteneri (B2B)</option>
          </select>
          <button className="btn btn-ink btn-sm h-10">Filtrează</button>
        </form>
        {rows.length ? (
          <Table>
            <thead>
              <tr><th>Comandă</th><th>Client</th><th>Status</th><th>Plată</th><th>Livrare</th><th className="!text-right">Total</th></tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/admin/comenzi/${o.id}`} className="font-mono font-medium text-ink no-underline hover:underline">{o.number}</Link>
                    <div className="spec">{formatDateTime(o.createdAt)}</div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">{o.customerName}{o.channel === 'b2b' ? <Badge tone="info">B2B</Badge> : null}{o.requiresRx ? <Badge>Rx</Badge> : null}</div>
                    <div className="text-[12.5px] text-graphite">{o.email}</div>
                  </td>
                  <td><Badge tone={STATUS[o.status].tone}>{STATUS[o.status].label}</Badge></td>
                  <td className="text-[13px]">{PAYMENT_LABEL[o.paymentMethod]}<div className={o.paymentStatus === 'paid' ? 'text-ok' : o.paymentStatus === 'failed' ? 'text-err' : 'text-graphite'}>{o.paymentStatus === 'paid' ? 'încasată' : o.paymentStatus === 'failed' ? 'eșuată' : 'neîncasată'}</div></td>
                  <td className="text-[13px]">{SHIPPING_LABEL[o.shippingMethod]}<div className="text-graphite">{o.shippingAddress?.city ?? ''}</div></td>
                  <td className="text-right font-bold tnum">{formatPrice(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty title="Nicio comandă găsită">Schimbă filtrele sau caută după alt termen.</Empty>
        )}
        <Pagination page={page} pages={pages} href={(p) => qs({ pagina: String(p) })} />
      </Panel>
    </>
  )
}
