import type { Metadata } from 'next'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { Suspense } from 'react'
import { QuickOrder } from '@/components/b2b/quick-order'
import { FrameArt } from '@/components/frame-art'
import { Icon } from '@/components/icons'
import { db } from '@/lib/db'
import { document, order } from '@/lib/db/schema'
import { formatDateTime, formatPrice } from '@/lib/format'
import { STATUS } from '@/lib/order-status'
import { partnerPrice } from '@/lib/pricing'
import { artOf } from '@/lib/product-art'
import { getWholesalePrices, requirePartner } from '@/server/b2b'
import { getCatalog, getStock } from '@/server/catalog'
import { getSettings } from '@/server/settings'

export const metadata: Metadata = { title: 'Portal parteneri', robots: { index: false } }

export default function PortalPage() {
  return (
    <div className="container-x pb-16 pt-10">
      <Suspense fallback={<div className="grid gap-4"><div className="skeleton h-24 w-1/2" /><div className="skeleton h-96" /></div>}>
        <Portal />
      </Suspense>
    </div>
  )
}

const TIER: Record<string, string> = { standard: 'Standard', silver: 'Silver', gold: 'Gold' }

async function Portal() {
  const me = await requirePartner()
  const [catalog, settings, orders, docs] = await Promise.all([
    getCatalog('all'),
    getSettings(),
    db.select().from(order).where(and(eq(order.partnerId, me.partner.id), eq(order.channel, 'b2b'))).orderBy(desc(order.createdAt)).limit(20),
    db.select().from(document).where(inArray(document.audience, ['b2b', 'public'])).orderBy(asc(document.title)),
  ])
  const [stocks, wholesale] = await Promise.all([Promise.all(catalog.map((p) => getStock(p.id))), getWholesalePrices()])
  const prices: Record<string, number> = {}
  const rows = catalog.flatMap((p, i) =>
    p.variants.map((v) => {
      const net = partnerPrice(wholesale.get(p.id) ?? Math.round(p.price / 2.4), me.partner.discountPercent)
      prices[v.sku] = net
      const warehouse = stocks[i]!.filter((s) => s.variantId === v.id && s.kind === 'warehouse').reduce((s, r) => s + r.available, 0)
      return { p, v, net, warehouse }
    }),
  )
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow">Portal parteneri · {me.partner.cui}</div>
          <h1 className="disp mt-3 text-[clamp(40px,5vw,72px)]">{me.partner.companyName}</h1>
        </div>
        <dl className="flex gap-6 text-[14px]">
          <div><dt className="spec">Nivel</dt><dd className="font-bold">{TIER[me.partner.tier] ?? me.partner.tier}</dd></div>
          <div><dt className="spec">Discount suplimentar</dt><dd className="font-bold tnum">{me.partner.discountPercent}%</dd></div>
          <div><dt className="spec">Termen de plată</dt><dd className="font-bold tnum">{me.partner.paymentTermsDays} zile</dd></div>
        </dl>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_420px]">
        <section className="card overflow-hidden bg-glass" aria-labelledby="lista">
          <div className="flex items-center justify-between gap-4 border-b border-line p-5">
            <h2 id="lista" className="text-[18px] font-bold">Listă de prețuri <span className="spec font-normal">(fără TVA)</span></h2>
            <a href="/api/private/b2b-pricelist" className="btn btn-secondary btn-sm"><Icon name="download" size={16} /> CSV</a>
          </div>
          <div className="max-h-[640px] overflow-auto">
            <table className="w-full text-[14px]">
              <thead className="sticky top-0 bg-glass">
                <tr className="spec text-left">
                  <th className="px-5 py-3 font-normal">Model</th>
                  <th className="px-3 py-3 font-normal">Cod</th>
                  <th className="px-3 py-3 text-right font-normal">PVP</th>
                  <th className="px-3 py-3 text-right font-normal">Preț net</th>
                  <th className="px-5 py-3 text-right font-normal">Stoc</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, v, net, warehouse }) => (
                  <tr key={v.id} className="border-t border-line-soft">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-3">
                        <FrameArt product={artOf(p)} swatch={v.swatch} className="h-6 w-14 shrink-0" />
                        <span><span className="font-bold">{p.name}</span> <span className="text-graphite">· {v.colorName}</span></span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[12.5px]">{v.sku}</td>
                    <td className="px-3 py-2.5 text-right text-graphite tnum">{formatPrice(p.price)}</td>
                    <td className="px-3 py-2.5 text-right font-bold tnum">{formatPrice(net)}</td>
                    <td className={`px-5 py-2.5 text-right tnum ${warehouse ? '' : 'text-err'}`}>{warehouse || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex flex-col gap-6">
          <section className="card bg-glass p-5" aria-labelledby="rapid">
            <h2 id="rapid" className="text-[18px] font-bold">Comandă rapidă</h2>
            <p className="mt-1 text-[13.5px] text-graphite">Un cod pe linie, urmat de cantitate. Comanda minimă: {formatPrice(settings.b2b.minOrder)} fără TVA.</p>
            <div className="mt-4"><QuickOrder prices={prices} minOrder={settings.b2b.minOrder} vat={settings.vat.standard} /></div>
          </section>
          <section className="card bg-glass p-5" aria-labelledby="docs">
            <h2 id="docs" className="text-[18px] font-bold">Documente</h2>
            {docs.length ? (
              <ul className="mt-3 flex flex-col gap-2">
                {docs.map((d) => (
                  <li key={d.id}><a href={`/api/private/document/${d.id}`} className="flex items-center gap-2 text-[14.5px] no-underline hover:underline"><Icon name="file" size={18} /> {d.title}</a></li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[14px] text-graphite">Declarațiile de conformitate și fișele tehnice apar aici imediat ce sunt încărcate. Le poți cere și pe e-mail.</p>
            )}
          </section>
        </div>
      </div>

      <section className="card mt-6 bg-glass p-5" aria-labelledby="comenzi-b2b">
        <h2 id="comenzi-b2b" className="text-[18px] font-bold">Comenzi</h2>
        {orders.length ? (
          <table className="mt-3 w-full text-[14px]">
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-line-soft">
                  <td className="py-3 font-mono">{o.number}</td>
                  <td className="py-3 text-graphite">{formatDateTime(o.createdAt)}</td>
                  <td className="py-3"><span className="rounded-full bg-paper px-2.5 py-1 text-[12.5px] font-bold ring-1 ring-line-soft">{STATUS[o.status].label}</span></td>
                  <td className="py-3 text-right font-bold tnum">{formatPrice(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-2 text-[14px] text-graphite">Nicio comandă încă.</p>
        )}
      </section>
    </>
  )
}
