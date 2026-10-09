import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { CouponForm } from '@/components/cart/coupon-form'
import { LineControls } from '@/components/cart/line-controls'
import { LineSummary } from '@/components/cart/line-summary'
import { FrameArt } from '@/components/frame-art'
import { Icon } from '@/components/icons'
import { formatFrameSize, formatPrice } from '@/lib/format'
import { artOf } from '@/lib/product-art'
import { loadCart } from '@/server/cart'
import { getSettings } from '@/server/settings'

export const metadata: Metadata = { title: 'Coșul tău', robots: { index: false } }

export default function CartPage() {
  return (
    <div className="container-x pb-16 pt-10">
      <h1 className="disp text-[clamp(44px,6vw,84px)]">Coșul tău.</h1>
      <Suspense fallback={<div className="mt-10 grid gap-4 lg:grid-cols-[1fr_380px]"><div className="skeleton h-64" /><div className="skeleton h-80" /></div>}>
        <Cart />
      </Suspense>
    </div>
  )
}

async function Cart() {
  const [cart, settings] = await Promise.all([loadCart(), getSettings()])
  if (!cart.lines.length) {
    return (
      <div className="card mt-10 flex flex-col items-center px-6 py-20 text-center">
        <div aria-hidden className="chart-row text-[64px] text-ink/60 blur-[5px]">∅</div>
        <h2 className="disp mt-4 text-[32px]">Coșul e gol.</h2>
        <p className="mt-2 max-w-md text-graphite">Alege o ramă, configurează lentilele și o găsești aici.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/rame-de-vedere" className="btn btn-primary">Rame de vedere</Link>
          <Link href="/ochelari-de-soare" className="btn btn-secondary">Ochelari de soare</Link>
        </div>
      </div>
    )
  }
  const t = cart.totals
  const freeProgress = Math.min(1, (t.subtotal - t.discount) / settings.shipping.freeThreshold)
  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_400px]">
      <div>
        {cart.problems.length ? (
          <div role="alert" className="mb-5 rounded-2xl bg-warn-50 p-4 text-[14.5px] text-warn">
            {cart.problems.map((p) => (
              <p key={p} className="flex items-start gap-2"><Icon name="alert" size={18} className="mt-0.5 shrink-0" /> {p}</p>
            ))}
          </div>
        ) : null}
        <ul className="divide-y divide-line border-y border-line">
          {cart.lines.map((l) => (
            <li key={l.id} className="grid grid-cols-[110px_1fr] gap-5 py-6 sm:grid-cols-[160px_1fr_auto]">
              <Link href={`/rame/${l.product.slug}`} className="grid aspect-[4/3] place-items-center rounded-2xl bg-glass ring-1 ring-line-soft">
                <FrameArt product={artOf(l.product)} swatch={l.variant.swatch} className="h-auto w-[84%]" />
              </Link>
              <div className="min-w-0">
                <Link href={`/rame/${l.product.slug}`} className="text-[17px] font-bold no-underline hover:underline">{l.product.name}</Link>
                <p className="spec mt-0.5">{formatFrameSize(l.product)} · {l.variant.colorName.toLowerCase()}</p>
                <div className="mt-2"><LineSummary line={l} /></div>
                <div className="mt-3"><LineControls lineId={l.id} quantity={l.quantity} adjustable={l.configuration.lensType === 'none'} /></div>
              </div>
              <div className="col-start-2 text-left sm:col-start-auto sm:text-right">
                <div className="text-[17px] font-bold tnum">{formatPrice(l.priced.unitPrice * l.quantity)}</div>
                {l.quantity > 1 ? <div className="spec">{l.quantity} × {formatPrice(l.priced.unitPrice)}</div> : null}
              </div>
            </li>
          ))}
        </ul>
        <Link href="/rame-de-vedere" className="mt-6 inline-flex items-center gap-2 text-[15px] font-bold no-underline hover:underline">
          <Icon name="arrow-left" size={16} /> Continuă cumpărăturile
        </Link>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Sumar comandă">
        <div className="card bg-glass p-6">
          {t.freeShippingRemaining > 0 ? (
            <div className="mb-5">
              <p className="text-[14px]">Mai ai <strong className="tnum">{formatPrice(t.freeShippingRemaining)}</strong> până la livrare gratuită.</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full bg-cobalt" style={{ width: `${freeProgress * 100}%` }} /></div>
            </div>
          ) : (
            <p className="mb-5 flex items-center gap-2 text-[14px] font-bold text-ok"><Icon name="truck" size={18} /> Livrare gratuită</p>
          )}
          <dl className="flex flex-col gap-2.5 text-[15px]">
            <div className="flex justify-between"><dt>Subtotal</dt><dd className="tnum">{formatPrice(t.subtotal)}</dd></div>
            {t.discount ? <div className="flex justify-between text-ok"><dt>Reducere {t.couponApplied}</dt><dd className="tnum">−{formatPrice(t.discount)}</dd></div> : null}
            <div className="flex justify-between"><dt>Livrare</dt><dd className="text-graphite">{t.shipping ? `de la ${formatPrice(settings.shipping.easybox.price)}` : 'gratuită'}</dd></div>
          </dl>
          <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
            <span className="text-[17px] font-bold">Total</span>
            <span className="disp text-[32px] tnum">{formatPrice(t.subtotal - t.discount + t.shipping)}</span>
          </div>
          <p className="spec mt-1 text-right">TVA inclus · livrarea se alege la pasul următor</p>
          <div className="mt-5"><CouponForm current={cart.couponCode} /></div>
          {t.couponError ? <p className="mt-2 text-[13px] text-err">{t.couponError}</p> : null}
          <Link href="/checkout" aria-disabled={cart.problems.length > 0} className={`btn btn-primary btn-lg mt-5 w-full ${cart.problems.length ? 'pointer-events-none opacity-50' : ''}`}>
            Finalizează comanda <Icon name="arrow-right" size={20} />
          </Link>
          <ul className="mt-5 flex flex-col gap-2 text-[13px] text-graphite">
            <li className="flex items-center gap-2"><Icon name="lock" size={16} /> Plată securizată sau ramburs</li>
            <li className="flex items-center gap-2"><Icon name="refresh" size={16} /> Retur {settings.policies.returnDays} de zile pentru rame · garanție de adaptare</li>
          </ul>
        </div>
      </aside>
    </div>
  )
}
