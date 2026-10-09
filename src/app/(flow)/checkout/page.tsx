import type { Metadata } from 'next'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { CheckoutForm } from '@/components/checkout/checkout-form'
import { db } from '@/lib/db'
import { coupon } from '@/lib/db/schema'
import { artOf } from '@/lib/product-art'
import { formatPhone } from '@/lib/ro'
import { loadCart } from '@/server/cart'
import { availableCardProvider } from '@/server/payments'
import { getCurrentUser } from '@/server/session'
import { getSettings } from '@/server/settings'

export const metadata: Metadata = { title: 'Finalizează comanda', robots: { index: false } }

export default function CheckoutPage() {
  return (
    <div className="container-x py-10">
      <div className="eyebrow">Pasul final</div>
      <h1 className="disp mt-3 text-[clamp(40px,5vw,68px)]">Finalizează comanda.</h1>
      <div className="mt-8">
        <Suspense fallback={<div className="grid gap-6 lg:grid-cols-[1fr_420px]"><div className="skeleton h-[600px]" /><div className="skeleton h-[480px]" /></div>}>
          <Checkout />
        </Suspense>
      </div>
    </div>
  )
}

async function Checkout() {
  const [cart, settings, user] = await Promise.all([loadCart(), getSettings(), getCurrentUser()])
  if (!cart.lines.length) redirect('/cos')
  if (cart.problems.length) redirect('/cos')
  const cp = cart.couponCode ? await db.query.coupon.findFirst({ where: eq(coupon.code, cart.couponCode) }) : null
  const provider = settings.payments.card.enabled ? availableCardProvider(settings.payments.card.provider) : null
  const [firstName, ...rest] = (user?.name ?? '').split(' ')
  return (
    <CheckoutForm
      lines={cart.lines.map((l) => ({
        id: l.id,
        name: l.product.name,
        variant: l.variant.colorName,
        detail: l.priced.lines.filter((x) => x.code.startsWith('type:')).map((x) => x.label).join(', ') || 'Rama',
        amount: l.priced.unitPrice * l.quantity,
        quantity: l.quantity,
        art: artOf(l.product),
        swatch: l.variant.swatch,
      }))}
      subtotal={cart.totals.subtotal}
      discount={cart.totals.discount}
      couponCode={cart.totals.couponApplied ?? null}
      freeShippingByCoupon={cp?.kind === 'free_shipping' && !cart.totals.couponError}
      shipping={settings.shipping}
      payments={{
        card: !!provider,
        cardSimulated: provider === 'simulated',
        cod: settings.payments.cod.enabled,
        codMax: settings.payments.cod.maxTotal,
        transfer: settings.payments.transfer.enabled,
        store: settings.payments.store.enabled,
      }}
      requiresRx={cart.lines.some((l) => !['none', 'plano'].includes(l.configuration.lensType))}
      showroomAddress={`${settings.company.address}, ${settings.company.city}`}
      prefill={{ email: user?.email ?? '', firstName: firstName ?? '', lastName: rest.join(' '), phone: user?.phone ? formatPhone(user.phone) : '' }}
    />
  )
}
