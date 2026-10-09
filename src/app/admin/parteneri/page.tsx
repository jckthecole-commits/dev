import { desc, eq, sql } from 'drizzle-orm'
import Link from 'next/link'
import { Suspense } from 'react'
import { approvePartner, savePartnerTerms, setPartnerStatus } from '@/app/admin/_actions/people'
import { ActionButton } from '@/components/admin/action-button'
import { AdminForm } from '@/components/admin/form'
import { Badge, Empty, Field, input, PageHeader, Panel } from '@/components/admin/ui'
import { Icon } from '@/components/icons'
import { db } from '@/lib/db'
import { partner } from '@/lib/db/schema'
import { formatDate, formatPrice } from '@/lib/format'
import { formatPhone } from '@/lib/ro'
import { can, requireStaff } from '@/server/session'

export const metadata = { title: 'Parteneri B2B' }

const TABS = [
  { key: 'pending', label: 'Cereri noi' },
  { key: 'approved', label: 'Activi' },
  { key: 'suspended', label: 'Suspendați' },
  { key: 'rejected', label: 'Respinși' },
] as const

export default function Partners({ searchParams }: Pick<PageProps<'/admin/parteneri'>, 'searchParams'>) {
  return (
    <Suspense fallback={<div className="skeleton h-[500px]" />}>
      <List searchParams={searchParams} />
    </Suspense>
  )
}

async function List({ searchParams }: Pick<PageProps<'/admin/parteneri'>, 'searchParams'>) {
  const me = await requireStaff('orders:read')
  const writable = can(me.role, 'partners:write')
  const sp = await searchParams
  const tab = TABS.find((t) => t.key === sp.status)?.key ?? 'pending'
  const [rows, counts] = await Promise.all([
    db
      .select({
        p: partner,
        orders: sql<number>`(select count(*) from "order" o where o.partner_id = "partner"."id" and o.status <> 'cancelled')::int`,
        revenue: sql<number>`(select coalesce(sum(o.total),0) from "order" o where o.partner_id = "partner"."id" and o.status <> 'cancelled')::bigint`,
        lastOrder: sql<string | null>`(select max(o.created_at) from "order" o where o.partner_id = "partner"."id")`,
      })
      .from(partner)
      .where(eq(partner.status, tab))
      .orderBy(desc(partner.createdAt)),
    db.select({ status: partner.status, n: sql<number>`count(*)::int` }).from(partner).groupBy(partner.status),
  ])
  return (
    <>
      <PageHeader eyebrow="Clienți" title="Parteneri B2B">
        <p className="mt-2 max-w-2xl text-[14.5px] text-graphite">Optici care cumpără en-gros. La aprobare se creează contul (sau se leagă de cel existent) și partenerul primește acces la portal, prețuri nete și comandă rapidă pe SKU.</p>
      </PageHeader>
      <nav aria-label="Filtru status" className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/parteneri?status=${t.key}`} aria-current={t.key === tab ? 'page' : undefined} className="tab-pill">
            {t.label} <span className="ml-1 font-mono text-[12px] opacity-70">{counts.find((c) => c.status === t.key)?.n ?? 0}</span>
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <Panel><Empty icon="building" title={tab === 'pending' ? 'Nicio cerere nouă' : 'Nimic aici'}>{tab === 'pending' ? 'Cererile din pagina /b2b apar aici.' : undefined}</Empty></Panel>
      ) : (
        <div className="flex flex-col gap-5">
          {rows.map(({ p, orders, revenue, lastOrder }) => (
            <Panel key={p.id}>
              <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[18px] font-bold">{p.companyName}</h2>
                    <Badge tone={p.tier === 'gold' ? 'warn' : p.tier === 'silver' ? 'info' : 'neutral'}>{p.tier}</Badge>
                    {p.userId ? <Badge tone="ok">cont legat</Badge> : <Badge>fără cont</Badge>}
                  </div>
                  <div className="mt-1 text-[13.5px]">
                    CUI <a href={`https://www.listafirme.ro/search.asp?searchfor=${encodeURIComponent(p.cui)}`} target="_blank" rel="noreferrer" className="font-mono text-cobalt">{p.cui}</a>
                    {p.regCom ? ` · ${p.regCom}` : ''} · {p.city}, {p.county}
                    {p.storesCount ? ` · ${p.storesCount} ${p.storesCount === 1 ? 'magazin' : 'magazine'}` : ''}
                  </div>
                  <div className="mt-3 text-[14px]">
                    {p.contactName} · <a href={`tel:${p.phone}`}>{formatPhone(p.phone)}</a> · <a href={`mailto:${p.email}`} className="text-cobalt">{p.email}</a>
                    {p.website ? <> · <a href={p.website.startsWith('http') ? p.website : `https://${p.website}`} target="_blank" rel="noreferrer" className="text-cobalt">site</a></> : null}
                  </div>
                  <div className="text-[13.5px] text-graphite">{p.address}</div>
                  {p.message ? <p className="mt-3 rounded-xl bg-fog p-3 text-[14px]">„{p.message}”</p> : null}
                  <dl className="mt-4 grid grid-cols-3 gap-3 text-[13px]">
                    <div className="rounded-xl bg-paper p-3 ring-1 ring-line-soft"><dt className="text-graphite">Comenzi</dt><dd className="text-[18px] font-bold tnum">{orders}</dd></div>
                    <div className="rounded-xl bg-paper p-3 ring-1 ring-line-soft"><dt className="text-graphite">Valoare</dt><dd className="text-[18px] font-bold tnum">{formatPrice(Number(revenue))}</dd></div>
                    <div className="rounded-xl bg-paper p-3 ring-1 ring-line-soft"><dt className="text-graphite">Ultima</dt><dd className="text-[14px] font-bold">{lastOrder ? formatDate(lastOrder, { day: 'numeric', month: 'short' }) : '—'}</dd></div>
                  </dl>
                  <p className="mt-3 text-[12.5px] text-graphite">Cerere din {formatDate(p.createdAt)}{p.approvedAt ? ` · aprobat ${formatDate(p.approvedAt)}` : ''}</p>
                </div>
                <div>
                  {writable ? (
                    <>
                      <div className="mb-4 flex flex-wrap gap-2">
                        {p.status !== 'approved' ? <ActionButton action={approvePartner.bind(null, p.id)} variant="primary"><Icon name="check" size={16} /> Aprobă & trimite acces</ActionButton> : null}
                        {p.status === 'approved' ? <ActionButton action={setPartnerStatus.bind(null, p.id, 'suspended')} variant="ghost" confirm="Suspenzi accesul la portal?">Suspendă</ActionButton> : null}
                        {p.status === 'pending' ? <ActionButton action={setPartnerStatus.bind(null, p.id, 'rejected')} variant="ghost" confirm="Respingi cererea? Partenerul primește un e-mail politicos.">Respinge</ActionButton> : null}
                        {p.status === 'rejected' || p.status === 'suspended' ? <ActionButton action={setPartnerStatus.bind(null, p.id, 'pending')} variant="ghost">Readu în așteptare</ActionButton> : null}
                      </div>
                      <AdminForm action={savePartnerTerms.bind(null, p.id)} submit="Salvează condițiile">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <Field label="Nivel">
                            <select name="tier" defaultValue={p.tier} className={input}><option value="standard">Standard</option><option value="silver">Silver</option><option value="gold">Gold</option></select>
                          </Field>
                          <Field label="Discount extra %"><input name="discountPercent" type="number" min={0} max={40} defaultValue={p.discountPercent} className={input} /></Field>
                          <Field label="Termen plată (zile)"><input name="paymentTermsDays" type="number" min={0} max={90} defaultValue={p.paymentTermsDays} className={input} /></Field>
                          <Field label="Limită credit (lei)"><input name="creditLimit" type="number" min={0} defaultValue={p.creditLimit == null ? '' : p.creditLimit / 100} className={input} /></Field>
                        </div>
                        <Field label="Notă internă"><textarea name="internalNote" rows={2} defaultValue={p.internalNote ?? ''} className="field h-auto py-2.5 text-[14px]" /></Field>
                      </AdminForm>
                    </>
                  ) : (
                    <p className="text-[14px]">Discount {p.discountPercent}% · plată la {p.paymentTermsDays} zile</p>
                  )}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  )
}
