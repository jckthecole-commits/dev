import { and, asc, desc, eq, gte, inArray, lt, ne, sql } from 'drizzle-orm'
import Link from 'next/link'
import { Suspense } from 'react'
import { RevenueChart } from '@/components/admin/revenue-chart'
import { Badge, Empty, PageHeader, Panel, StatTile, Table } from '@/components/admin/ui'
import { Icon } from '@/components/icons'
import { db } from '@/lib/db'
import { appointment, inventory, location, order, partner, prescription, product, variant } from '@/lib/db/schema'
import { formatDateTime, formatPrice, formatTime } from '@/lib/format'
import { STATUS, type OrderStatus } from '@/lib/order-status'
import { goLiveChecklist } from '@/lib/settings-schema'
import { addDays, zonedDay, zonedToUtc } from '@/lib/time'
import { requireStaff } from '@/server/session'
import { getSettings } from '@/server/settings'

export default function AdminHome() {
  return (
    <Suspense fallback={<div className="grid gap-4"><div className="skeleton h-12 w-64" /><div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-28" />)}</div><div className="skeleton h-72" /></div>}>
      <Dashboard />
    </Suspense>
  )
}

const pct = (a: number, b: number) => (b === 0 ? (a ? 100 : 0) : ((a - b) / b) * 100)

async function Dashboard() {
  const me = await requireStaff('orders:read')
  const now = new Date()
  const today = zonedDay(now)
  const from30 = zonedToUtc(addDays(today, -29), '00:00')
  const from60 = zonedToUtc(addDays(today, -59), '00:00')
  const dayStart = zonedToUtc(today, '00:00')
  const dayEnd = zonedToUtc(addDays(today, 1), '00:00')
  const counted = ne(order.status, 'cancelled')

  const [cur, prev, daily, pipeline, recent, rxPending, todayAppts, lowStock, partnersPending, settings] = await Promise.all([
    db.select({ revenue: sql<number>`coalesce(sum(${order.total}),0)::bigint`, n: sql<number>`count(*)::int` }).from(order).where(and(gte(order.createdAt, from30), counted)),
    db.select({ revenue: sql<number>`coalesce(sum(${order.total}),0)::bigint`, n: sql<number>`count(*)::int` }).from(order).where(and(gte(order.createdAt, from60), lt(order.createdAt, from30), counted)),
    db.execute<{ day: string; revenue: number; orders: number }>(sql`
      select to_char((${order.createdAt} at time zone 'Europe/Bucharest')::date, 'YYYY-MM-DD') as day, coalesce(sum(${order.total}),0)::bigint as revenue, count(*)::int as orders
      from ${order} where ${order.createdAt} >= ${from30.toISOString()}::timestamptz and ${order.status} <> 'cancelled' group by 1 order by 1`),
    db.select({ status: order.status, n: sql<number>`count(*)::int` }).from(order).where(inArray(order.status, ['pending_payment', 'placed', 'rx_review', 'on_hold', 'in_lab', 'qc', 'ready', 'shipped'])).groupBy(order.status),
    db.select().from(order).orderBy(desc(order.createdAt)).limit(8),
    db.select({ n: sql<number>`count(*)::int` }).from(prescription).where(eq(prescription.status, 'pending')),
    db.query.appointment.findMany({ where: and(gte(appointment.startsAt, dayStart), lt(appointment.startsAt, dayEnd), inArray(appointment.status, ['booked', 'confirmed'])), with: { service: true }, orderBy: asc(appointment.startsAt) }),
    db
      .select({ sku: variant.sku, name: product.name, color: variant.colorName, loc: location.name, available: sql<number>`(${inventory.onHand} - ${inventory.reserved})::int`, reorder: inventory.reorderPoint, productId: product.id })
      .from(inventory)
      .innerJoin(variant, eq(variant.id, inventory.variantId))
      .innerJoin(product, eq(product.id, variant.productId))
      .innerJoin(location, eq(location.id, inventory.locationId))
      .where(and(eq(product.status, 'active'), sql`${inventory.onHand} - ${inventory.reserved} <= ${inventory.reorderPoint}`))
      .orderBy(sql`${inventory.onHand} - ${inventory.reserved}`)
      .limit(8),
    db.select({ n: sql<number>`count(*)::int` }).from(partner).where(eq(partner.status, 'pending')),
    getSettings(),
  ])

  const revenue = Number(cur[0]?.revenue ?? 0)
  const prevRevenue = Number(prev[0]?.revenue ?? 0)
  const orders = cur[0]?.n ?? 0
  const prevOrders = prev[0]?.n ?? 0
  const aov = orders ? Math.round(revenue / orders) : 0
  const prevAov = prevOrders ? Math.round(prevRevenue / prevOrders) : 0
  const series = Array.from({ length: 30 }, (_, i) => {
    const day = addDays(today, -29 + i)
    const row = daily.find((d) => d.day === day)
    return { day, revenue: Number(row?.revenue ?? 0), orders: Number(row?.orders ?? 0) }
  })
  const pipeMax = Math.max(1, ...pipeline.map((p) => p.n))
  const ORDER: OrderStatus[] = ['pending_payment', 'placed', 'rx_review', 'on_hold', 'in_lab', 'qc', 'ready', 'shipped']
  const checklist = goLiveChecklist(settings, process.env)
  const done = checklist.filter((c) => c.done).length

  return (
    <>
      <PageHeader eyebrow={new Intl.DateTimeFormat('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Bucharest' }).format(now)} title={`Bună, ${me.name.split(' ')[0]}.`} actions={<Link href="/admin/comenzi?status=deschise" className="btn btn-ink btn-sm"><Icon name="bag" size={16} /> Comenzi deschise</Link>} />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile label="Venituri · 30 zile" value={formatPrice(revenue)} delta={pct(revenue, prevRevenue)} icon="chart" href="/admin/comenzi" />
        <StatTile label="Comenzi · 30 zile" value={String(orders)} delta={pct(orders, prevOrders)} icon="bag" href="/admin/comenzi" />
        <StatTile label="Valoare medie comandă" value={formatPrice(aov)} delta={pct(aov, prevAov)} icon="tag" />
        <StatTile label="Rețete de verificat" value={String(rxPending[0]?.n ?? 0)} icon="rx" href="/admin/retete" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <Panel title="Venituri pe zi · ultimele 30 de zile" action={<span className="spec">lei, TVA inclus</span>}>
          <RevenueChart data={series} />
        </Panel>
        <Panel title="Comenzi în lucru">
          {pipeline.length ? (
            <ul className="flex flex-col gap-2.5">
              {ORDER.filter((s) => pipeline.some((p) => p.status === s)).map((s) => {
                const n = pipeline.find((p) => p.status === s)?.n ?? 0
                return (
                  <li key={s}>
                    <Link href={`/admin/comenzi?status=${s}`} className="grid grid-cols-[130px_1fr_32px] items-center gap-3 text-[13.5px] no-underline">
                      <span>{STATUS[s].label}</span>
                      <span className="h-3 rounded-r-[4px] bg-cobalt" style={{ width: `${(n / pipeMax) * 100}%`, minWidth: 4 }} />
                      <span className="text-right font-bold tnum">{n}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <Empty title="Nicio comandă în lucru" icon="check" />
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <Panel title="Comenzi recente" pad={false} action={<Link href="/admin/comenzi" className="text-[13.5px] font-bold text-cobalt">Toate</Link>}>
          <Table>
            <thead>
              <tr><th>Comandă</th><th>Client</th><th>Status</th><th className="!text-right">Total</th></tr>
            </thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/admin/comenzi/${o.id}`} className="font-mono font-medium text-ink no-underline hover:underline">{o.number}</Link><div className="spec">{formatDateTime(o.createdAt)}</div></td>
                  <td>{o.customerName}{o.channel === 'b2b' ? <Badge tone="info" className="ml-2">B2B</Badge> : null}</td>
                  <td><Badge tone={STATUS[o.status].tone}>{STATUS[o.status].label}</Badge></td>
                  <td className="text-right font-bold tnum">{formatPrice(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
        <div className="flex flex-col gap-6">
          <Panel title={`Programări azi · ${todayAppts.length}`} action={<Link href="/admin/programari" className="text-[13.5px] font-bold text-cobalt">Agenda</Link>}>
            {todayAppts.length ? (
              <ul className="flex flex-col gap-2">
                {todayAppts.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 text-[14px]">
                    <span className="w-12 font-mono font-medium tnum">{formatTime(a.startsAt)}</span>
                    <span className="flex-1"><span className="font-bold">{a.name}</span> <span className="text-graphite">· {a.service.name}</span></span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-graphite">Nicio programare azi.</p>
            )}
          </Panel>
          <Panel title="Stoc scăzut" action={<Link href="/admin/produse?stoc=scazut" className="text-[13.5px] font-bold text-cobalt">Toate</Link>}>
            {lowStock.length ? (
              <ul className="flex flex-col gap-2 text-[13.5px]">
                {lowStock.map((s) => (
                  <li key={s.sku + s.loc} className="flex items-center justify-between gap-3">
                    <Link href={`/admin/produse/${s.productId}`} className="no-underline hover:underline"><span className="font-bold">{s.name}</span> · {s.color}<div className="spec">{s.loc}</div></Link>
                    <Badge tone={s.available <= 0 ? 'err' : 'warn'}>{s.available} buc</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-graphite">Toate stocurile sunt peste pragul de reaprovizionare.</p>
            )}
          </Panel>
          <Panel title={`Pregătire lansare · ${done}/${checklist.length}`} action={<Link href="/admin/integrari" className="text-[13.5px] font-bold text-cobalt">Detalii</Link>}>
            <div className="h-2 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full bg-cobalt" style={{ width: `${(done / checklist.length) * 100}%` }} /></div>
            <ul className="mt-3 flex flex-col gap-1.5 text-[13.5px]">
              {checklist.filter((c) => !c.done).slice(0, 4).map((c) => (
                <li key={c.key}><Link href={c.href} className="flex items-center gap-2 no-underline hover:underline"><Icon name="alert" size={15} className="text-warn" /> {c.label}</Link></li>
              ))}
            </ul>
            {partnersPending[0]?.n ? <p className="mt-3 text-[13.5px]"><Link href="/admin/parteneri" className="font-bold text-cobalt">{partnersPending[0].n === 1 ? '1 cerere B2B' : `${partnersPending[0].n} cereri B2B`}</Link> {partnersPending[0].n === 1 ? 'așteaptă' : 'așteaptă'} răspuns.</p> : null}
          </Panel>
        </div>
      </div>
    </>
  )
}
