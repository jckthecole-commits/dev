import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Icon } from '@/components/icons'
import { OrderRxUpload } from '@/components/order/rx-upload'
import { cn } from '@/lib/cn'
import { formatDateTime, formatPrice } from '@/lib/format'
import { PAYMENT_LABEL, PAYMENT_STATUS_LABEL, SHIPPING_LABEL, STATUS, TRACK_STEPS } from '@/lib/order-status'
import { getAccessibleOrder } from '@/server/order-access'
import { getSettings } from '@/server/settings'

export const metadata: Metadata = { title: 'Comanda ta', robots: { index: false, follow: false } }

export default function OrderPage({ params, searchParams }: PageProps<'/comanda/[number]'>) {
  return (
    <div className="container-x pb-16 pt-10">
      <Suspense fallback={<div className="skeleton h-[480px]" />}>
        <OrderView params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

const TONE = { neutral: 'bg-line-soft text-ink', info: 'bg-cobalt-50 text-cobalt', warn: 'bg-warn-50 text-warn', ok: 'bg-ok-50 text-ok', err: 'bg-err-50 text-err' }

async function OrderView({ params, searchParams }: PageProps<'/comanda/[number]'>) {
  const { number } = await params
  const sp = await searchParams
  const token = typeof sp.t === 'string' ? sp.t : undefined
  const [o, settings] = await Promise.all([getAccessibleOrder(number, token), getSettings()])
  if (!o) notFound()
  const st = STATUS[o.status]
  const stepIndex = TRACK_STEPS.findIndex((s) => s.key.includes(o.status))
  const needsRx = o.items.filter((i) => i.configuration && i.configuration.rxMode === 'later' && !i.prescriptionId)
  const events = o.events.filter((e) => e.public).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  const first = o.customerName.split(' ')[0]

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_400px]">
      <div>
        <div className="eyebrow">Comanda {o.number}</div>
        <h1 className="disp mt-3 text-[clamp(40px,5.6vw,76px)]">{sp.nou || sp.plata ? `Mulțumim, ${first}!` : 'Comanda ta.'}</h1>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className={cn('rounded-full px-3 py-1.5 text-[13.5px] font-bold', TONE[st.tone])}>{st.label}</span>
          <span className="spec">plasată {o.placedAt ? formatDateTime(o.placedAt) : ''}</span>
        </div>
        <p className="mt-4 max-w-xl text-[17px] text-ink-2">{st.customer} Ți-am trimis detaliile și pe e-mail, la {o.email}.</p>

        {sp.anulat || sp.eroare || o.paymentStatus === 'failed' ? (
          <div role="alert" className="mt-6 flex items-start gap-3 rounded-2xl bg-warn-50 p-4 text-[14.5px] text-warn">
            <Icon name="alert" size={20} className="mt-0.5 shrink-0" />
            <span>Plata cu cardul nu s-a finalizat. Comanda e păstrată — ne poți suna pentru plata prin transfer sau ramburs, ori încearcă din nou din coș.</span>
          </div>
        ) : null}

        {o.paymentMethod === 'transfer' && o.paymentStatus !== 'paid' ? (
          <div className="mt-6 rounded-2xl bg-cobalt-50 p-5 text-[15px]">
            <div className="font-bold">Plată prin transfer bancar</div>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
              <dt className="text-graphite">Beneficiar</dt>
              <dd>{settings.company.legalName}</dd>
              <dt className="text-graphite">IBAN</dt>
              <dd className="font-mono">{settings.company.iban || 'îl primești pe e-mail'}</dd>
              <dt className="text-graphite">Sumă</dt>
              <dd className="font-bold tnum">{formatPrice(o.total)}</dd>
              <dt className="text-graphite">Detalii</dt>
              <dd className="font-mono">{o.number}</dd>
            </dl>
          </div>
        ) : null}

        {needsRx.length && !['cancelled', 'delivered'].includes(o.status) ? (
          <div className="mt-6 rounded-2xl bg-glass p-5 ring-1 ring-line-soft">
            <div className="flex items-center gap-2 text-[16px] font-bold">
              <Icon name="rx" size={20} /> Trimite-ne rețeta
            </div>
            <p className="mt-1 text-[14.5px] text-graphite">Lentilele intră în producție după ce optometristul verifică rețeta. Fișierul e criptat.</p>
            <div className="mt-4 flex flex-col gap-3">
              {needsRx.map((i) => (
                <OrderRxUpload key={i.id} number={o.number} token={token ?? ''} itemId={i.id} productName={i.productName} />
              ))}
            </div>
          </div>
        ) : null}

        {o.status !== 'cancelled' ? (
          <ol className="mt-10 grid grid-cols-5 gap-2" aria-label="Progres comandă">
            {TRACK_STEPS.map((s, i) => {
              const done = i < stepIndex || (i === stepIndex && o.status === 'delivered')
              const current = i === stepIndex && o.status !== 'delivered'
              return (
                <li key={s.label} className="flex flex-col gap-2">
                  <span className={cn('h-1.5 rounded-full', done ? 'bg-ink' : current ? 'bg-cobalt' : 'bg-line')} />
                  <span className={cn('text-[12.5px] leading-tight', done || current ? 'font-bold text-ink' : 'text-graphite')}>{s.label}</span>
                </li>
              )
            })}
          </ol>
        ) : null}

        <h2 className="mt-12 text-[18px] font-bold">Produse</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {o.items.map((i) => (
            <li key={i.id} className="flex items-start justify-between gap-6 py-4">
              <div>
                <div className="font-bold">
                  {i.quantity > 1 ? `${i.quantity}× ` : ''}
                  {i.productName} · {i.variantName}
                </div>
                <div className="mt-1 text-[13.5px] text-graphite">{i.priceBreakdown.filter((x) => x.code !== 'frame').map((x) => x.label).join(' · ') || 'Doar rama'}</div>
                {i.prescription ? (
                  <div className="mt-1 text-[13px] font-bold">
                    Rețetă: <span className={i.prescription.status === 'verified' ? 'text-ok' : i.prescription.status === 'needs_info' ? 'text-warn' : 'text-graphite'}>{i.prescription.status === 'verified' ? 'verificată ✓' : i.prescription.status === 'needs_info' ? 'avem o întrebare' : 'în verificare'}</span>
                  </div>
                ) : null}
              </div>
              <div className="shrink-0 font-bold tnum">{formatPrice(i.lineTotal)}</div>
            </li>
          ))}
        </ul>

        {events.length ? (
          <>
            <h2 className="mt-12 text-[18px] font-bold">Istoric</h2>
            <ol className="mt-4 flex flex-col gap-4 border-l border-line pl-5">
              {events.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full bg-ink ring-4 ring-fog" />
                  <div className="text-[15px]">{e.message}</div>
                  <div className="spec">{formatDateTime(e.createdAt)}</div>
                </li>
              ))}
            </ol>
          </>
        ) : null}
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card bg-glass p-6">
          <dl className="flex flex-col gap-2.5 text-[15px]">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd className="tnum">{formatPrice(o.subtotal)}</dd>
            </div>
            {o.discountTotal ? (
              <div className="flex justify-between text-ok">
                <dt>Reducere</dt>
                <dd className="tnum">−{formatPrice(o.discountTotal)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt>Livrare</dt>
              <dd className="tnum">{o.shippingTotal ? formatPrice(o.shippingTotal) : 'gratuită'}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-line pt-3">
              <dt className="font-bold">Total</dt>
              <dd className="disp text-[28px] tnum">{formatPrice(o.total)}</dd>
            </div>
          </dl>
          <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 border-t border-line pt-5 text-[14px]">
            <dt className="text-graphite">Plată</dt>
            <dd>
              {PAYMENT_LABEL[o.paymentMethod]} · {PAYMENT_STATUS_LABEL[o.paymentStatus]}
            </dd>
            <dt className="text-graphite">Livrare</dt>
            <dd>{SHIPPING_LABEL[o.shippingMethod]}</dd>
            {o.shippingAddress ? (
              <>
                <dt className="text-graphite">Adresă</dt>
                <dd>
                  {o.shippingAddress.street}
                  {o.shippingAddress.city ? `, ${o.shippingAddress.city}` : ''}
                  {o.shippingAddress.county ? `, ${o.shippingAddress.county}` : ''}
                </dd>
              </>
            ) : null}
            {o.awb ? (
              <>
                <dt className="text-graphite">AWB</dt>
                <dd>
                  <a href={o.trackingUrl ?? `https://sameday.ro/#awb=${o.awb}`} target="_blank" rel="noopener noreferrer" className="font-mono text-cobalt underline">
                    {o.awb}
                  </a>
                </dd>
              </>
            ) : null}
          </dl>
          <div className="mt-6 flex flex-col gap-2 border-t border-line pt-5 text-[14px]">
            <span className="font-bold">Ai o întrebare?</span>
            <a href={`mailto:${settings.company.email}?subject=Comanda%20${o.number}`} className="flex items-center gap-2 no-underline hover:underline">
              <Icon name="mail" size={18} /> {settings.company.email}
            </a>
            {settings.company.phone ? (
              <a href={`tel:${settings.company.phone}`} className="flex items-center gap-2 no-underline hover:underline">
                <Icon name="phone" size={18} /> {settings.company.phone}
              </a>
            ) : null}
            <Link href="/cont/autentificare" className="mt-2 text-cobalt underline">
              Creează-ți cont ca să vezi toate comenzile
            </Link>
          </div>
        </div>
      </aside>
    </div>
  )
}
