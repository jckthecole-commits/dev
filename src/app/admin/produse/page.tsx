import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm'
import Link from 'next/link'
import { Suspense } from 'react'
import { setProductStatus } from '@/app/admin/_actions/products'
import { ActionButton } from '@/components/admin/action-button'
import { Badge, Empty, PageHeader, Panel, Table } from '@/components/admin/ui'
import { FrameArt } from '@/components/frame-art'
import { Icon } from '@/components/icons'
import { db } from '@/lib/db'
import { product, variant, type Swatch } from '@/lib/db/schema'
import { formatPrice } from '@/lib/format'
import { artOf, swatchCss } from '@/lib/product-art'
import { SHAPE_LABEL } from '@/lib/product-derive'
import { can, requireStaff } from '@/server/session'

export const metadata = { title: 'Produse & stoc' }

const STATUS_LABEL = { active: 'Publicat', draft: 'Ciornă', archived: 'Arhivat' } as const

export default function Products({ searchParams }: Pick<PageProps<'/admin/produse'>, 'searchParams'>) {
  return (
    <Suspense fallback={<div className="skeleton h-[600px]" />}>
      <List searchParams={searchParams} />
    </Suspense>
  )
}

async function List({ searchParams }: Pick<PageProps<'/admin/produse'>, 'searchParams'>) {
  const me = await requireStaff('orders:read')
  const sp = await searchParams
  const q = typeof sp.q === 'string' ? sp.q.trim() : ''
  const cat = sp.cat === 'optical' || sp.cat === 'sun' ? sp.cat : ''
  const status = sp.status === 'draft' || sp.status === 'archived' || sp.status === 'active' ? sp.status : ''
  const low = sp.stoc === 'scazut'
  const writable = can(me.role, 'catalog:write')

  const where: SQL[] = []
  if (q) where.push(or(ilike(product.name, `%${q}%`), ilike(product.modelCode, `%${q}%`), sql`exists (select 1 from variant v where v.product_id = "product"."id" and (v.sku ilike ${`%${q}%`} or v.ean = ${q}))`)!)
  if (cat) where.push(eq(product.category, cat))
  if (status) where.push(eq(product.status, status))
  else where.push(inArray(product.status, ['active', 'draft']))
  if (low) where.push(sql`exists (select 1 from inventory i join variant v on v.id = i.variant_id where v.product_id = "product"."id" and v.active and i.on_hand - i.reserved <= i.reorder_point)`)

  const rows = await db
    .select({
      p: product,
      stock: sql<number>`coalesce((select sum(i.on_hand - i.reserved) from inventory i join variant v on v.id = i.variant_id where v.product_id = "product"."id" and v.active), 0)::int`,
      lowCount: sql<number>`(select count(*) from inventory i join variant v on v.id = i.variant_id where v.product_id = "product"."id" and v.active and i.on_hand - i.reserved <= i.reorder_point)::int`,
      sold30: sql<number>`coalesce((select sum(oi.quantity) from order_item oi join "order" o on o.id = oi.order_id where oi.product_id = "product"."id" and o.status <> 'cancelled' and o.created_at > now() - interval '30 days'), 0)::int`,
    })
    .from(product)
    .where(and(...where))
    .orderBy(asc(sql`case ${product.status} when 'active' then 0 when 'draft' then 1 else 2 end`), desc(product.featured), asc(product.position))
  const ids = rows.map((r) => r.p.id)
  const variants = ids.length ? await db.select({ productId: variant.productId, swatch: variant.swatch, colorName: variant.colorName, active: variant.active }).from(variant).where(inArray(variant.productId, ids)).orderBy(asc(variant.position)) : []
  const counts = await db.select({ status: product.status, n: sql<number>`count(*)::int` }).from(product).groupBy(product.status)
  const qs = (patch: Record<string, string>) => {
    const u = new URLSearchParams({ ...(q && { q }), ...(cat && { cat }), ...(status && { status }), ...(low && { stoc: 'scazut' }), ...patch })
    for (const [k, v] of [...u.entries()]) if (!v) u.delete(k)
    const s = u.toString()
    return `/admin/produse${s ? `?${s}` : ''}`
  }

  return (
    <>
      <PageHeader
        eyebrow={`Catalog · ${counts.find((c) => c.status === 'active')?.n ?? 0} publicate`}
        title="Produse & stoc"
        actions={writable ? <Link href="/admin/produse/nou" className="btn btn-primary btn-sm"><Icon name="plus" size={16} /> Produs nou</Link> : null}
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {([['', 'Toate'], ['optical', 'Rame de vedere'], ['sun', 'Ochelari de soare']] as const).map(([v, l]) => (
          <Link key={v || 'all'} href={qs({ cat: v })} aria-current={cat === v ? 'page' : undefined} className="tab-pill">{l}</Link>
        ))}
        <span className="mx-1 h-5 w-px bg-line" />
        {([['', 'Active + ciorne'], ['active', 'Publicate'], ['draft', 'Ciorne'], ['archived', 'Arhivate']] as const).map(([v, l]) => (
          <Link key={v || 'any'} href={qs({ status: v })} aria-current={status === v ? 'page' : undefined} className="tab-pill">{l}</Link>
        ))}
        <Link href={qs({ stoc: low ? '' : 'scazut' })} aria-current={low ? 'page' : undefined} className="tab-pill"><Icon name="alert" size={14} className="mr-1 inline" />Stoc scăzut</Link>
        <form action="/admin/produse" className="ml-auto flex items-center gap-2">
          {cat ? <input type="hidden" name="cat" value={cat} /> : null}
          <input type="search" name="q" defaultValue={q} placeholder="Nume, cod model, SKU, EAN" aria-label="Caută produse" className="field h-10 w-64 text-[14px]" />
        </form>
      </div>

      <Panel pad={false}>
        {rows.length === 0 ? (
          <Empty icon="glasses" title="Niciun produs">Schimbă filtrele sau adaugă un produs nou.</Empty>
        ) : (
          <Table>
            <thead>
              <tr><th className="w-[120px]" /><th>Produs</th><th>Culori</th><th className="!text-right">Preț</th><th className="!text-right">Stoc</th><th className="!text-right">Vândute 30z</th><th>Status</th>{writable ? <th /> : null}</tr>
            </thead>
            <tbody>
              {rows.map(({ p, stock, lowCount, sold30 }) => {
                const vs = variants.filter((v) => v.productId === p.id)
                const first = vs.find((v) => v.active) ?? vs[0]
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/produse/${p.id}`} className="block rounded-xl bg-fog px-2 py-1.5">
                        {first ? <FrameArt product={artOf(p)} swatch={first.swatch as Swatch} className="h-auto w-full" idSalt={`adm-${p.id}`} /> : null}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/admin/produse/${p.id}`} className="font-bold text-ink no-underline hover:underline">{p.name}</Link>
                      {p.featured ? <Icon name="star" size={13} className="ml-1.5 inline text-cobalt" aria-label="Recomandat" /> : null}
                      <div className="spec">{p.modelCode} · {p.lensWidth}□{p.bridgeWidth} {p.templeLength} · {SHAPE_LABEL[p.shape]}</div>
                    </td>
                    <td>
                      <span className="flex flex-wrap gap-1">
                        {vs.map((v, i) => <span key={i} title={v.colorName} className={`size-4 rounded-full ring-1 ring-line ${v.active ? '' : 'opacity-30'}`} style={{ background: swatchCss(v.swatch as Swatch) }} />)}
                      </span>
                    </td>
                    <td className="text-right tnum">{formatPrice(p.price)}{p.compareAtPrice ? <div className="text-[12px] text-graphite line-through">{formatPrice(p.compareAtPrice)}</div> : null}</td>
                    <td className="text-right tnum">
                      <span className={stock <= 0 ? 'font-bold text-err' : lowCount ? 'font-bold text-warn' : ''}>{stock}</span>
                      {lowCount ? <div className="text-[12px] text-warn">{lowCount} sub prag</div> : null}
                    </td>
                    <td className="text-right tnum">{sold30 || '—'}</td>
                    <td><Badge tone={p.status === 'active' ? 'ok' : p.status === 'draft' ? 'warn' : 'neutral'}>{STATUS_LABEL[p.status]}</Badge>{p.category === 'sun' ? <div className="spec mt-1">soare</div> : null}</td>
                    {writable ? (
                      <td className="text-right">
                        {p.status === 'active' ? <ActionButton action={setProductStatus.bind(null, p.id, 'draft')} variant="ghost">Retrage</ActionButton> : <ActionButton action={setProductStatus.bind(null, p.id, 'active')} variant="ghost">Publică</ActionButton>}
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Panel>
    </>
  )
}
