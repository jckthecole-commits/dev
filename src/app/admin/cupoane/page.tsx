import { desc, sql } from 'drizzle-orm'
import { Suspense } from 'react'
import { saveCoupon, toggleCoupon } from '@/app/admin/_actions/catalog-extra'
import { ActionButton } from '@/components/admin/action-button'
import { AdminForm } from '@/components/admin/form'
import { Badge, Empty, Field, input, PageHeader, Panel, Table } from '@/components/admin/ui'
import { db } from '@/lib/db'
import { coupon, type Coupon } from '@/lib/db/schema'
import { formatDate, formatPrice } from '@/lib/format'
import { zonedDay } from '@/lib/time'
import { can, requireStaff } from '@/server/session'

export const metadata = { title: 'Cupoane' }

export default function Coupons() {
  return (
    <Suspense fallback={<div className="skeleton h-[500px]" />}>
      <List />
    </Suspense>
  )
}

const valueText = (c: Coupon) => (c.kind === 'percent' ? `−${c.value}%` : c.kind === 'fixed' ? `−${formatPrice(c.value)}` : 'Transport gratuit')
const SCOPE = { all: 'toată comanda', frames: 'doar rame', lenses: 'doar lentile' } as Record<string, string>

function CouponFields({ c }: { c?: Coupon }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Cod"><input name="code" defaultValue={c?.code} required className={`${input} font-mono uppercase`} placeholder="TOAMNA15" /></Field>
      <Field label="Tip">
        <select name="kind" defaultValue={c?.kind ?? 'percent'} className={input}><option value="percent">Procent</option><option value="fixed">Sumă fixă (lei)</option><option value="free_shipping">Transport gratuit</option></select>
      </Field>
      <Field label="Valoare" hint="% sau lei"><input name="value" type="number" min={0} step="1" defaultValue={c ? (c.kind === 'fixed' ? c.value / 100 : c.value) : 10} className={input} /></Field>
      <Field label="Comandă minimă (lei)"><input name="minSubtotal" type="number" min={0} step="1" defaultValue={c ? c.minSubtotal / 100 : 0} className={input} /></Field>
      <Field label="Se aplică la">
        <select name="appliesTo" defaultValue={c?.appliesTo ?? 'all'} className={input}><option value="all">Toată comanda</option><option value="frames">Doar rame</option><option value="lenses">Doar lentile</option></select>
      </Field>
      <Field label="De la"><input name="startsAt" type="date" defaultValue={c?.startsAt ? zonedDay(c.startsAt) : ''} className={input} /></Field>
      <Field label="Până la"><input name="endsAt" type="date" defaultValue={c?.endsAt ? zonedDay(c.endsAt) : ''} className={input} /></Field>
      <Field label="Limită utilizări" hint="Gol = nelimitat"><input name="usageLimit" type="number" min={1} defaultValue={c?.usageLimit ?? ''} className={input} /></Field>
      <Field label="Descriere internă" className="sm:col-span-2 lg:col-span-3"><input name="description" defaultValue={c?.description ?? ''} className={input} placeholder="ex. Campanie newsletter octombrie" /></Field>
      <label className="flex items-center gap-2 self-end pb-3 text-[14px]"><input type="checkbox" name="active" defaultChecked={c?.active ?? true} className="size-4 accent-cobalt" /> Activ</label>
    </div>
  )
}

async function List() {
  const me = await requireStaff('orders:read')
  const writable = can(me.role, 'catalog:write')
  const rows = await db
    .select({ c: coupon, expired: sql<boolean>`coalesce(${coupon.endsAt} < now(), false)`, scheduled: sql<boolean>`coalesce(${coupon.startsAt} > now(), false)` })
    .from(coupon)
    .orderBy(desc(coupon.active), desc(coupon.createdAt))
  const state = ({ c, expired, scheduled }: (typeof rows)[number]): [string, 'ok' | 'warn' | 'neutral' | 'err'] => {
    if (!c.active) return ['inactiv', 'neutral']
    if (expired) return ['expirat', 'err']
    if (scheduled) return ['programat', 'warn']
    if (c.usageLimit && c.usedCount >= c.usageLimit) return ['epuizat', 'err']
    return ['activ', 'ok']
  }
  return (
    <>
      <PageHeader eyebrow="Marketing" title="Cupoane" />
      {writable ? (
        <Panel title="Cupon nou" className="mb-6">
          <AdminForm action={saveCoupon.bind(null, null)} submit="Creează cuponul"><CouponFields /></AdminForm>
        </Panel>
      ) : null}
      <Panel pad={false}>
        {rows.length ? (
          <Table>
            <thead><tr><th>Cod</th><th>Reducere</th><th>Condiții</th><th>Perioadă</th><th className="!text-right">Folosit</th><th>Status</th>{writable ? <th /> : null}</tr></thead>
            <tbody>
              {rows.map((row) => {
                const { c } = row
                const [label, tone] = state(row)
                return (
                  <tr key={c.id} className="align-top">
                    <td><span className="font-mono font-bold">{c.code}</span>{c.description ? <div className="text-[12.5px] text-graphite">{c.description}</div> : null}</td>
                    <td className="font-bold">{valueText(c)}</td>
                    <td className="text-[13.5px]">{SCOPE[c.appliesTo]}{c.minSubtotal ? ` · min. ${formatPrice(c.minSubtotal)}` : ''}</td>
                    <td className="text-[13.5px]">{c.startsAt || c.endsAt ? `${c.startsAt ? formatDate(c.startsAt, { day: 'numeric', month: 'short' }) : '…'} – ${c.endsAt ? formatDate(c.endsAt, { day: 'numeric', month: 'short', year: 'numeric' }) : '…'}` : 'oricând'}</td>
                    <td className="text-right tnum">{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</td>
                    <td><Badge tone={tone}>{label}</Badge></td>
                    {writable ? (
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <ActionButton action={toggleCoupon.bind(null, c.id, !c.active)} variant="ghost">{c.active ? 'Dezactivează' : 'Activează'}</ActionButton>
                          <details className="relative">
                            <summary className="btn btn-ghost btn-sm">Editează</summary>
                            <div className="absolute right-0 z-20 mt-2 w-[min(860px,80vw)] rounded-2xl bg-glass p-5 text-left shadow-[var(--shadow-lift)] ring-1 ring-line">
                              <AdminForm action={saveCoupon.bind(null, c.id)}><CouponFields c={c} /></AdminForm>
                            </div>
                          </details>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </Table>
        ) : (
          <Empty icon="tag" title="Niciun cupon" />
        )}
      </Panel>
    </>
  )
}
