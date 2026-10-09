import type { Metadata } from 'next'
import { eq } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { Icon } from '@/components/icons'
import { db } from '@/lib/db'
import { order } from '@/lib/db/schema'
import { safeEqual } from '@/lib/crypto'
import { formatPrice } from '@/lib/format'
import { markOrderPaid, markOrderPaymentFailed } from '@/server/orders'

export const metadata: Metadata = { title: 'Simulare plată', robots: { index: false } }

const allowed = () => process.env.NODE_ENV !== 'production' || process.env.ALLOW_SIMULATED_PAYMENTS === 'true'

async function decide(formData: FormData) {
  'use server'
  if (!allowed()) notFound()
  const number = String(formData.get('o'))
  const t = String(formData.get('t'))
  const o = await db.query.order.findFirst({ where: eq(order.number, number) })
  if (!o || !safeEqual(t, o.accessToken)) notFound()
  if (formData.get('decision') === 'approve') {
    await markOrderPaid(o.number, `SIM-${o.number}`, 'simulated')
    redirect(`/comanda/${o.number}?t=${o.accessToken}&plata=1`)
  }
  await markOrderPaymentFailed(o.number, 'refuzată în simulator')
  redirect(`/comanda/${o.number}?t=${o.accessToken}&anulat=1`)
}

export default function SimulatedPayment({ searchParams }: Pick<PageProps<'/plata/simulare'>, 'searchParams'>) {
  return (
    <div className="container-x grid min-h-[70vh] place-items-center py-16">
      <Suspense fallback={<div className="skeleton h-80 w-full max-w-md" />}>
        <Panel searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function Panel({ searchParams }: Pick<PageProps<'/plata/simulare'>, 'searchParams'>) {
  await connection()
  if (!allowed()) notFound()
  const sp = await searchParams
  const o = await db.query.order.findFirst({ where: eq(order.number, String(sp.o ?? '')) })
  if (!o || !safeEqual(String(sp.t ?? ''), o.accessToken)) notFound()
  return (
    <form action={decide} className="card w-full max-w-md bg-glass p-8 text-center">
      <input type="hidden" name="o" value={o.number} />
      <input type="hidden" name="t" value={o.accessToken} />
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-cobalt text-white">
        <Icon name="card" size={26} />
      </span>
      <div className="eyebrow mt-6">Mediu de test · nu se debitează nimic</div>
      <h1 className="disp mt-3 text-[34px]">Simulare plată card</h1>
      <p className="mt-3 text-[15px] text-ink-2">
        Comanda <strong>{o.number}</strong> · <strong className="tnum">{formatPrice(o.total)}</strong>. Configurează Netopia sau Stripe în variabilele de mediu pentru plăți reale.
      </p>
      <div className="mt-7 flex flex-col gap-3">
        <button name="decision" value="approve" className="btn btn-primary w-full">
          Aprobă plata
        </button>
        <button name="decision" value="decline" className="btn btn-secondary w-full">
          Refuză plata
        </button>
      </div>
    </form>
  )
}
