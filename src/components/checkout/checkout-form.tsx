'use client'

import { useActionForm } from '@/lib/use-action-form'
import Link from 'next/link'
import { useState } from 'react'
import { checkout } from '@/app/actions/checkout'
import { FrameArt, type FrameArtProduct } from '@/components/frame-art'
import { Icon, type IconName } from '@/components/icons'
import { cn } from '@/lib/cn'
import type { Swatch } from '@/lib/db/schema'
import { formatPrice } from '@/lib/format'
import { COUNTIES } from '@/lib/ro'

export type CheckoutLine = { id: string; name: string; variant: string; detail: string; amount: number; quantity: number; art: FrameArtProduct; swatch: Swatch }
export type CheckoutProps = {
  lines: CheckoutLine[]
  subtotal: number
  discount: number
  couponCode: string | null
  freeShippingByCoupon: boolean
  shipping: {
    freeThreshold: number
    courier: { enabled: boolean; price: number; label: string; eta: string; carrier: string }
    easybox: { enabled: boolean; price: number; label: string; eta: string }
    pickup: { enabled: boolean; price: number; label: string; eta: string }
    codFee: number
  }
  payments: { card: boolean; cod: boolean; codMax: number; transfer: boolean; store: boolean; cardSimulated: boolean }
  requiresRx: boolean
  showroomAddress: string
  prefill: { email: string; firstName: string; lastName: string; phone: string }
}

type Ship = 'courier' | 'easybox' | 'pickup'
type Pay = 'card' | 'cod' | 'transfer' | 'store'

export function CheckoutForm(p: CheckoutProps) {
  const [state, onSubmit, pending] = useActionForm(checkout, null)
  const [ship, setShip] = useState<Ship>(p.shipping.courier.enabled ? 'courier' : p.shipping.easybox.enabled ? 'easybox' : 'pickup')
  const [pay, setPay] = useState<Pay>(p.payments.card ? 'card' : 'cod')
  const [billing, setBilling] = useState<'person' | 'company'>('person')
  const fe = state?.fieldErrors ?? {}

  const afterDiscount = p.subtotal - p.discount
  const free = afterDiscount >= p.shipping.freeThreshold || p.freeShippingByCoupon
  const shipCost = ship === 'pickup' || free ? 0 : p.shipping[ship].price
  const codFee = pay === 'cod' ? p.shipping.codFee : 0
  const total = afterDiscount + shipCost + codFee
  const codAllowed = p.payments.cod && total <= p.payments.codMax && ship !== 'pickup'
  const effectivePay: Pay = pay === 'store' && ship !== 'pickup' ? 'cod' : pay === 'cod' && !codAllowed ? (p.payments.card ? 'card' : 'transfer') : pay

  const shipOptions: { v: Ship; icon: IconName; title: string; eta: string; price: number; enabled: boolean }[] = [
    { v: 'courier', icon: 'truck', title: p.shipping.courier.label, eta: p.shipping.courier.eta, price: p.shipping.courier.price, enabled: p.shipping.courier.enabled },
    { v: 'easybox', icon: 'locker', title: p.shipping.easybox.label, eta: p.shipping.easybox.eta, price: p.shipping.easybox.price, enabled: p.shipping.easybox.enabled },
    { v: 'pickup', icon: 'store', title: p.shipping.pickup.label, eta: p.showroomAddress, price: 0, enabled: p.shipping.pickup.enabled },
  ]
  const payOptions: { v: Pay; icon: IconName; title: string; hint: string; enabled: boolean }[] = [
    { v: 'card', icon: 'card', title: 'Card online', hint: p.payments.cardSimulated ? 'Mediu de test — plată simulată' : 'Visa, Mastercard · 3-D Secure', enabled: p.payments.card },
    { v: 'cod', icon: 'cash', title: 'Ramburs la curier', hint: codAllowed ? (p.shipping.codFee ? `+${formatPrice(p.shipping.codFee)} taxă ramburs` : 'Plătești la livrare') : ship === 'pickup' ? 'Nu se aplică la ridicare' : `Până la ${formatPrice(p.payments.codMax)}`, enabled: codAllowed },
    { v: 'transfer', icon: 'bank', title: 'Transfer bancar', hint: 'Producția începe după încasare', enabled: p.payments.transfer },
    { v: 'store', icon: 'store', title: 'Plătesc la ridicare', hint: 'Numerar sau card, în showroom', enabled: p.payments.store && ship === 'pickup' },
  ]

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-10 lg:grid-cols-[1fr_420px] lg:gap-14">
      <input type="hidden" name="shippingMethod" value={ship} />
      <input type="hidden" name="paymentMethod" value={effectivePay} />
      <input type="hidden" name="billingType" value={billing} />
      <input type="hidden" name="requiresRx" value={p.requiresRx ? '1' : '0'} />
      <div className="flex flex-col gap-5">
        <Section n={1} title="Date de contact">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="firstName" label="Prenume" autoComplete="given-name" defaultValue={p.prefill.firstName} error={fe.firstName} />
            <Field name="lastName" label="Nume" autoComplete="family-name" defaultValue={p.prefill.lastName} error={fe.lastName} />
            <Field name="email" label="E-mail" type="email" autoComplete="email" defaultValue={p.prefill.email} error={fe.email} hint="Aici primești confirmarea și linkul de urmărire." />
            <Field name="phone" label="Telefon" type="tel" autoComplete="tel" inputMode="tel" defaultValue={p.prefill.phone} error={fe.phone} hint="Pentru curier și pentru întrebări despre rețetă." />
          </div>
        </Section>

        <Section n={2} title="Livrare">
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Metoda de livrare">
            {shipOptions
              .filter((o) => o.enabled)
              .map((o) => (
                <button key={o.v} type="button" role="radio" aria-checked={ship === o.v} onClick={() => setShip(o.v)} className={cn('flex flex-col items-start gap-1 rounded-2xl p-4 text-left ring-1 transition-[box-shadow,background-color]', ship === o.v ? 'bg-cobalt-50 ring-[1.5px] ring-cobalt' : 'bg-paper ring-line hover:ring-graphite')}>
                  <Icon name={o.icon} className={ship === o.v ? 'text-cobalt' : ''} />
                  <span className="mt-1 text-[15px] font-bold">{o.title}</span>
                  <span className="text-[12.5px] leading-snug text-graphite">{o.eta}</span>
                  <span className="mt-1 text-[14px] font-bold tnum">{o.v === 'pickup' || free ? 'gratuit' : formatPrice(o.price)}</span>
                </button>
              ))}
          </div>
          {ship === 'courier' ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-6">
              <Field className="sm:col-span-6" name="street" label="Strada, număr, bloc, apartament" autoComplete="street-address" error={fe.street} />
              <Field className="sm:col-span-3" name="city" label="Localitate" autoComplete="address-level2" error={fe.city} />
              <CountySelect className="sm:col-span-2" name="county" error={fe.county} />
              <Field className="sm:col-span-1" name="postalCode" label="Cod poștal" autoComplete="postal-code" inputMode="numeric" />
            </div>
          ) : ship === 'easybox' ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field className="sm:col-span-2" name="locker" label="easybox preferat" placeholder="ex. easybox Mega Image Țiglina, Galați" error={fe.locker} hint="Scrie orașul și adresa sau numele lockerului. Confirmăm prin SMS înainte de expediere." />
              <Field name="city" label="Localitate" autoComplete="address-level2" />
              <CountySelect name="county" />
            </div>
          ) : (
            <p className="mt-5 flex items-start gap-3 rounded-2xl bg-glass p-4 text-[14.5px] ring-1 ring-line-soft">
              <Icon name="pin" size={20} className="mt-0.5 shrink-0" />
              <span>
                Te așteptăm la <strong>{p.showroomAddress}</strong>. Îți scriem când ochelarii sunt gata și îi ajustăm pe fața ta la ridicare.
              </span>
            </p>
          )}
        </Section>

        <Section n={3} title="Facturare">
          <div className="flex gap-2">
            {(
              [
                ['person', 'Persoană fizică'],
                ['company', 'Persoană juridică'],
              ] as const
            ).map(([v, label]) => (
              <button key={v} type="button" aria-pressed={billing === v} onClick={() => setBilling(v)} className={cn('btn btn-sm', billing === v ? 'btn-ink' : 'btn-secondary')}>
                {label}
              </button>
            ))}
          </div>
          {billing === 'company' ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-6">
              <Field className="sm:col-span-6" name="company" label="Denumire firmă" autoComplete="organization" error={fe.company} />
              <Field className="sm:col-span-3" name="cui" label="CUI" placeholder="RO12345678" error={fe.cui} />
              <Field className="sm:col-span-3" name="regCom" label="Nr. Reg. Com. (opțional)" placeholder="J17/123/2020" />
              {ship !== 'courier' ? (
                <>
                  <Field className="sm:col-span-6" name="billingStreet" label="Adresa sediului" error={fe.billingStreet} />
                  <Field className="sm:col-span-3" name="billingCity" label="Localitate" />
                  <CountySelect className="sm:col-span-3" name="billingCounty" />
                </>
              ) : (
                <p className="text-[13.5px] text-graphite sm:col-span-6">Folosim adresa de livrare ca adresă a sediului. Dacă diferă, scrie-ne în observații.</p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-[13.5px] text-graphite">Factura se emite pe numele de mai sus și o primești pe e-mail.</p>
          )}
        </Section>

        <Section n={4} title="Plată">
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Metoda de plată">
            {payOptions.map((o) => (
              <button
                key={o.v}
                type="button"
                role="radio"
                aria-checked={effectivePay === o.v}
                disabled={!o.enabled}
                onClick={() => setPay(o.v)}
                className={cn('flex items-center gap-4 rounded-2xl p-4 text-left ring-1 transition-[box-shadow,background-color] disabled:opacity-45', effectivePay === o.v ? 'bg-cobalt-50 ring-[1.5px] ring-cobalt' : 'bg-paper ring-line hover:ring-graphite')}
              >
                <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', effectivePay === o.v ? 'bg-cobalt text-white' : 'bg-fog')}>
                  <Icon name={o.icon} size={20} />
                </span>
                <span>
                  <span className="block text-[15px] font-bold">{o.title}</span>
                  <span className="block text-[12.5px] text-graphite">{o.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </Section>

        <Section n={5} title="Observații (opțional)">
          <textarea name="note" rows={3} maxLength={800} placeholder="Interval de livrare, interfon, întrebări pentru optometrist…" className="field h-auto py-3" aria-label="Observații" />
        </Section>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Sumar">
        <div className="card bg-glass p-6">
          <h2 className="text-[17px] font-bold">Comanda ta</h2>
          <ul className="mt-4 flex flex-col gap-4">
            {p.lines.map((l) => (
              <li key={l.id} className="flex gap-3">
                <span className="grid h-14 w-20 shrink-0 place-items-center rounded-xl bg-paper ring-1 ring-line-soft">
                  <FrameArt product={l.art} swatch={l.swatch} className="h-auto w-[86%]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-bold">
                    {l.quantity > 1 ? `${l.quantity}× ` : ''}
                    {l.name}
                  </span>
                  <span className="block truncate text-[12.5px] text-graphite">
                    {l.variant} · {l.detail}
                  </span>
                </span>
                <span className="text-[14px] font-bold tnum">{formatPrice(l.amount)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-5 flex flex-col gap-2 border-t border-line pt-4 text-[14.5px]">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd className="tnum">{formatPrice(p.subtotal)}</dd>
            </div>
            {p.discount ? (
              <div className="flex justify-between text-ok">
                <dt>Reducere {p.couponCode}</dt>
                <dd className="tnum">−{formatPrice(p.discount)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt>Livrare</dt>
              <dd className="tnum">{shipCost ? formatPrice(shipCost) : 'gratuită'}</dd>
            </div>
            {codFee ? (
              <div className="flex justify-between">
                <dt>Taxă ramburs</dt>
                <dd className="tnum">{formatPrice(codFee)}</dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
            <span className="text-[17px] font-bold">Total</span>
            <span className="disp text-[34px] tnum">{formatPrice(total)}</span>
          </div>
          <p className="spec mt-1 text-right">TVA inclus</p>

          <div className="mt-5 flex flex-col gap-3 text-[13.5px] leading-snug">
            <Consent name="terms" error={fe.terms}>
              Am citit și accept{' '}
              <Link href="/termeni-si-conditii" target="_blank" className="text-cobalt underline">
                termenii și condițiile
              </Link>{' '}
              și{' '}
              <Link href="/retur-si-garantie" target="_blank" className="text-cobalt underline">
                politica de retur
              </Link>
              .
            </Consent>
            {p.requiresRx ? (
              <Consent name="healthConsent" error={fe.healthConsent}>
                Sunt de acord ca Sifra Vision să prelucreze datele din rețeta mea (date privind sănătatea) pentru realizarea lentilelor, conform{' '}
                <Link href="/politica-de-confidentialitate" target="_blank" className="text-cobalt underline">
                  politicii de confidențialitate
                </Link>
                .
              </Consent>
            ) : null}
            <Consent name="newsletter">Vreau noutăți pe e-mail (maximum una pe lună).</Consent>
          </div>

          {state && !state.ok ? (
            <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-err-50 px-3.5 py-2.5 text-[14px] text-err">
              <Icon name="alert" size={18} className="mt-0.5 shrink-0" /> {state.error}
            </p>
          ) : null}
          <button type="submit" disabled={pending} className="btn btn-primary btn-lg mt-5 w-full">
            {pending ? 'Se procesează…' : effectivePay === 'card' ? `Plătește ${formatPrice(total)}` : 'Plasează comanda'}
          </button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[12.5px] text-graphite">
            <Icon name="lock" size={14} /> {effectivePay === 'card' ? 'Ești redirecționat către procesatorul de plăți.' : 'Plătești doar când primești.'}
          </p>
        </div>
      </aside>
    </form>
  )
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card bg-glass p-5 sm:p-6">
      <h2 className="mb-5 flex items-center gap-3 text-[18px] font-bold">
        <span className="grid size-7 place-items-center rounded-full bg-ink font-mono text-[12px] text-fog">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Field({ name, label, error, hint, className, ...rest }: { name: string; label: string; error?: string; hint?: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `f-${name}`
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[14px] font-bold">
        {label}
      </label>
      <input id={id} name={name} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : hint ? `${id}-h` : undefined} className="field" {...rest} />
      {error ? (
        <p id={`${id}-e`} className="mt-1.5 text-[13px] text-err">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-h`} className="mt-1.5 text-[12.5px] text-graphite">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

function CountySelect({ name, error, className }: { name: string; error?: string; className?: string }) {
  const id = `f-${name}`
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[14px] font-bold">
        Județ
      </label>
      <select id={id} name={name} defaultValue="" aria-invalid={!!error} className="field">
        <option value="" disabled>
          Alege…
        </option>
        {COUNTIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1.5 text-[13px] text-err">{error}</p> : null}
    </div>
  )
}

function Consent({ name, error, children }: { name: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" name={name} className="peer sr-only" aria-invalid={!!error} />
        <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-[6px] bg-paper ring-1 ring-line peer-checked:bg-ink peer-checked:ring-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cobalt peer-aria-[invalid=true]:ring-err [&>svg]:hidden peer-checked:[&>svg]:block">
          <Icon name="check" size={14} strokeWidth={2.2} className="text-white" />
        </span>
        <span>{children}</span>
      </label>
      {error ? <p className="ml-8 mt-1 text-[12.5px] text-err">{error}</p> : null}
    </div>
  )
}
