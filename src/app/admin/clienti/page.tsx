import { sql } from 'drizzle-orm'
import Link from 'next/link'
import { Suspense } from 'react'
import { eraseCustomerAccount } from '@/app/admin/_actions/people'
import { ActionButton } from '@/components/admin/action-button'
import { Badge, Empty, PageHeader, Pagination, Panel, StatTile, Table } from '@/components/admin/ui'
import { Icon } from '@/components/icons'
import { db } from '@/lib/db'
import { formatDate, formatPrice } from '@/lib/format'
import { formatPhone } from '@/lib/ro'
import { can, requireStaff } from '@/server/session'

export const metadata = { title: 'Clienți' }
const PER = 40

export default function Customers({ searchParams }: Pick<PageProps<'/admin/clienti'>, 'searchParams'>) {
  return (
    <Suspense fallback={<div className="skeleton h-[600px]" />}>
      <List searchParams={searchParams} />
    </Suspense>
  )
}

type Row = { email: string; name: string | null; phone: string | null; orders: number; spent: string; last: string | null; user_id: string | null; marketing: boolean | null; created: string | null }

async function List({ searchParams }: Pick<PageProps<'/admin/clienti'>, 'searchParams'>) {
  const me = await requireStaff('orders:read')
  const sp = await searchParams
  const q = typeof sp.q === 'string' ? sp.q.trim().toLowerCase() : ''
  const page = Math.max(1, Number(sp.pagina) || 1)
  const gdpr = can(me.role, 'reports:read')
  const like = `%${q}%`
  // Every buyer (guest or account) by e-mail, plus registered customers without orders.
  const base = sql`
    with o as (
      select lower(email) as email, count(*)::int as orders, coalesce(sum(total),0)::bigint as spent, max(created_at) as last,
             (array_agg(customer_name order by created_at desc))[1] as name, (array_agg(phone order by created_at desc))[1] as phone,
             bool_or(marketing_consent) as marketing
      from "order" where status <> 'cancelled' and channel = 'b2c' group by lower(email)
    ), u as (select id, lower(email) as email, name, phone, marketing_consent, created_at from "user" where role = 'customer')
    select coalesce(o.email, u.email) as email, coalesce(u.name, o.name) as name, coalesce(u.phone, o.phone) as phone,
           coalesce(o.orders, 0) as orders, coalesce(o.spent, 0)::text as spent, o.last, u.id as user_id,
           coalesce(u.marketing_consent, o.marketing) as marketing, u.created_at as created
    from o full outer join u on u.email = o.email
    where ${q ? sql`(coalesce(o.email, u.email) like ${like} or lower(coalesce(u.name, o.name)) like ${like} or coalesce(u.phone, o.phone) like ${like})` : sql`true`}`
  const [rows, total, stats] = await Promise.all([
    db.execute<Row>(sql`${base} order by o.last desc nulls last, u.created_at desc limit ${PER} offset ${(page - 1) * PER}`),
    db.execute<{ n: number }>(sql`select count(*)::int as n from (${base}) t`),
    db.execute<{ buyers: number; repeat: number; accounts: number; ltv: string }>(sql`
      select count(*)::int as buyers, count(*) filter (where n > 1)::int as repeat, (select count(*)::int from "user" where role = 'customer') as accounts, coalesce(avg(s),0)::bigint::text as ltv
      from (select lower(email) e, count(*) n, sum(total) s from "order" where status <> 'cancelled' and channel = 'b2c' group by 1) t`),
  ])
  const st = stats[0]!
  const pages = Math.max(1, Math.ceil((total[0]?.n ?? 0) / PER))
  return (
    <>
      <PageHeader eyebrow="Clienți" title="Clienți" />
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile label="Cumpărători" value={String(st.buyers)} icon="users" />
        <StatTile label="Au revenit" value={st.buyers ? `${Math.round((st.repeat / st.buyers) * 100)}%` : '—'} icon="refresh" />
        <StatTile label="Conturi create" value={String(st.accounts)} icon="user" />
        <StatTile label="Valoare medie / client" value={formatPrice(Number(st.ltv))} icon="chart" />
      </div>
      <Panel pad={false}>
        <form action="/admin/clienti" className="flex items-center gap-3 border-b border-line-soft p-4">
          <input type="search" name="q" defaultValue={q} placeholder="Nume, e-mail sau telefon" aria-label="Caută clienți" className="field h-10 max-w-sm text-[14px]" />
          <span className="text-[13px] text-graphite">{total[0]?.n ?? 0} rezultate</span>
        </form>
        {rows.length ? (
          <Table>
            <thead><tr><th>Client</th><th>Contact</th><th className="!text-right">Comenzi</th><th className="!text-right">Total</th><th>Ultima comandă</th><th>Cont</th>{gdpr ? <th /> : null}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.email}>
                  <td><span className="font-bold">{r.name ?? '—'}</span>{r.marketing ? <Badge tone="info" className="ml-2">newsletter</Badge> : null}</td>
                  <td className="text-[13.5px]"><a href={`mailto:${r.email}`} className="text-cobalt">{r.email}</a>{r.phone ? <div>{formatPhone(r.phone)}</div> : null}</td>
                  <td className="text-right tnum">{r.orders ? <Link href={`/admin/comenzi?q=${encodeURIComponent(r.email)}`} className="font-bold text-ink">{r.orders}</Link> : '0'}</td>
                  <td className="text-right tnum">{formatPrice(Number(r.spent))}</td>
                  <td className="text-[13.5px]">{r.last ? formatDate(r.last, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                  <td>{r.user_id ? <Badge tone="ok">din {r.created ? formatDate(r.created, { month: 'short', year: 'numeric' }) : '—'}</Badge> : <Badge>vizitator</Badge>}</td>
                  {gdpr ? (
                    <td className="text-right">
                      {r.user_id ? (
                        <span className="flex justify-end gap-1">
                          <a href={`/api/private/customer-export/${r.user_id}`} className="btn btn-ghost btn-sm" title="Export GDPR (JSON)"><Icon name="download" size={15} /></a>
                          <ActionButton action={eraseCustomerAccount.bind(null, r.user_id)} variant="ghost" confirm={`Ștergi definitiv contul ${r.email}? Rețetele, adresele și sesiunile se șterg; comenzile rămân (obligație contabilă), fără legătură cu contul.`}><Icon name="trash" size={15} /></ActionButton>
                        </span>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty icon="users" title="Niciun client găsit" />
        )}
        <Pagination page={page} pages={pages} href={(p) => `/admin/clienti?${new URLSearchParams({ ...(q && { q }), pagina: String(p) })}`} />
      </Panel>
    </>
  )
}
