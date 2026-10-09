import { Suspense } from 'react'
import { saveSettingsSection } from '@/app/admin/_actions/settings'
import { AdminForm } from '@/components/admin/form'
import { Badge, PageHeader, Panel } from '@/components/admin/ui'
import { Icon } from '@/components/icons'
import { SITE_URL } from '@/lib/seo'
import { goLiveChecklist } from '@/lib/settings-schema'
import { connection } from 'next/server'
import { requireStaff } from '@/server/session'
import { getSettings } from '@/server/settings'

export const metadata = { title: 'Lansare & integrări' }

export default function Integrations() {
  return (
    <Suspense fallback={<div className="skeleton h-[700px]" />}>
      <Body />
    </Suspense>
  )
}

type Integration = { name: string; what: string; vars: string[]; ok: boolean; partial?: boolean; fallback: string; docs?: string }

async function Body() {
  await requireStaff('settings:write')
  await connection()
  const env = process.env
  const s = await getSettings()
  const list = goLiveChecklist(s, env)
  const done = list.filter((c) => c.done).length
  const has = (...k: string[]) => k.every((x) => !!env[x])
  const integrations: Integration[] = [
    { name: 'Netopia Payments (API v2)', what: 'Plăți cu card, 3-D Secure, IPN semnat (JWT RS512).', vars: ['NETOPIA_API_KEY', 'NETOPIA_POS_SIGNATURE', 'NETOPIA_PUBLIC_KEY', 'NETOPIA_SANDBOX'], ok: has('NETOPIA_API_KEY', 'NETOPIA_POS_SIGNATURE', 'NETOPIA_PUBLIC_KEY'), partial: has('NETOPIA_API_KEY'), fallback: env.ALLOW_SIMULATED_PAYMENTS === 'true' ? 'Simulator de plată activ (doar test).' : 'Plata cu card este ascunsă la checkout.', docs: 'https://doc.netopia-payments.com' },
    { name: 'Stripe Checkout', what: 'Alternativă la Netopia (carduri, Apple Pay, Google Pay).', vars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'], ok: has('STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'), partial: has('STRIPE_SECRET_KEY'), fallback: 'Neconfigurat.', docs: 'https://docs.stripe.com/payments/checkout' },
    { name: 'E-mail tranzacțional (SMTP)', what: 'Confirmări de comandă, rețete, programări, resetare parolă.', vars: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM', 'MAIL_STAFF'], ok: has('SMTP_HOST', 'MAIL_FROM'), partial: has('SMTP_HOST'), fallback: 'E-mailurile se salvează în .data/outbox (nu pleacă).' },
    { name: 'Stocare fișiere (S3 / R2)', what: 'Poze produse, rețete criptate (AES-256-GCM), documente.', vars: ['STORAGE_DRIVER=s3', 'S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'NEXT_PUBLIC_MEDIA_BASE_URL'], ok: env.STORAGE_DRIVER === 's3' && has('S3_ENDPOINT', 'S3_BUCKET'), fallback: 'Disc local (./storage) — ok pe un singur server cu volum persistent.' },
    { name: 'Criptare date medicale', what: 'Cheie AES-256 pentru rețete. Păstreaz-o în afara bazei de date și fă-i backup separat.', vars: ['DATA_ENCRYPTION_KEY'], ok: has('DATA_ENCRYPTION_KEY'), fallback: 'Cheie de dezvoltare — NU folosi în producție.' },
    { name: 'Autentificare Google', what: 'Butonul „Continuă cu Google” la cont.', vars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'], ok: has('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'), fallback: 'Doar e-mail + parolă.' },
    { name: 'Google Analytics 4 · Meta Pixel', what: 'Pornesc doar după acordul din bannerul de cookie-uri (Consent Mode v2).', vars: ['NEXT_PUBLIC_GA_ID', 'NEXT_PUBLIC_META_PIXEL_ID'], ok: has('NEXT_PUBLIC_GA_ID'), partial: has('NEXT_PUBLIC_META_PIXEL_ID'), fallback: 'Fără măsurare.' },
    { name: 'SmartBill · e-Factura', what: 'Emitere factură la încasare și transmitere SPV în 5 zile lucrătoare.', vars: ['SMARTBILL_USER', 'SMARTBILL_TOKEN', 'SMARTBILL_CIF', 'SMARTBILL_SERIES'], ok: has('SMARTBILL_TOKEN', 'SMARTBILL_CIF'), fallback: 'Facturile se emit manual; numărul se trece în comandă.', docs: 'https://api.smartbill.ro' },
  ]
  const feeds = [
    ['Sitemap', `${SITE_URL}/sitemap.xml`],
    ['Feed Google Merchant Center', `${SITE_URL}/feeds/google-merchant.xml`],
    ['robots.txt', `${SITE_URL}/robots.txt`],
    ['llms.txt (asistenți AI)', `${SITE_URL}/llms.txt`],
  ]

  return (
    <>
      <PageHeader eyebrow="Platformă" title="Lansare & integrări" />
      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Panel title={`Pregătire lansare · ${done}/${list.length}`}>
          <div className="mb-5 h-2 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full bg-cobalt" style={{ width: `${(done / list.length) * 100}%` }} /></div>
          <AdminForm action={saveSettingsSection.bind(null, 'launch')} submit="Salvează bifele">
            <ul className="flex flex-col gap-3">
              {list.map((c) => (
                <li key={c.key} className="flex gap-3">
                  {c.manual ? (
                    <input type="checkbox" name="confirmed" value={c.key} defaultChecked={c.done} className="mt-1 size-4 shrink-0 accent-cobalt" aria-label={`Confirmă: ${c.label}`} />
                  ) : (
                    <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${c.done ? 'bg-ok text-white' : 'bg-warn-50 text-warn'}`}><Icon name={c.done ? 'check' : 'alert'} size={13} /></span>
                  )}
                  <div className="text-[14px]">
                    <a href={c.href} className="font-bold text-ink no-underline hover:underline">{c.label}</a>
                    <div className="text-[13px] text-graphite">{c.hint}</div>
                  </div>
                </li>
              ))}
            </ul>
          </AdminForm>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel title="Integrări" pad={false}>
            <ul className="divide-y divide-line-soft">
              {integrations.map((i) => (
                <li key={i.name} className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold">{i.name}</span>
                    <Badge tone={i.ok ? 'ok' : i.partial ? 'warn' : 'neutral'}>{i.ok ? 'configurat' : i.partial ? 'incomplet' : 'neconfigurat'}</Badge>
                  </div>
                  <p className="mt-1 text-[13.5px] text-graphite">{i.what}</p>
                  {!i.ok ? <p className="mt-1 text-[13px]">Acum: {i.fallback}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {i.vars.map((v) => <code key={v} className={`rounded-md px-1.5 py-0.5 font-mono text-[11.5px] ${(v.includes('=') ? env[v.split('=')[0]!] === v.split('=')[1] : !!env[v]) ? 'bg-ok-50 text-ok' : 'bg-fog text-graphite'}`}>{v}</code>)}
                  </div>
                  {i.docs ? <a href={i.docs} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[13px] font-bold text-cobalt"><Icon name="external" size={13} /> Documentație</a> : null}
                </li>
              ))}
            </ul>
            <p className="border-t border-line-soft px-5 py-3 text-[12.5px] text-graphite">Valorile secrete nu sunt afișate niciodată aici. Se setează în variabilele de mediu ale serverului, apoi se repornește aplicația.</p>
          </Panel>
          <Panel title="Fluxuri publice">
            <ul className="flex flex-col gap-2 text-[14px]">
              {feeds.map(([l, u]) => (
                <li key={u} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{l}</span>
                  <a href={u} target="_blank" className="font-mono text-[12.5px] text-cobalt">{u!.replace(/^https?:\/\//, '')}</a>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  )
}
