import { Suspense } from 'react'
import { saveSettingsSection } from '@/app/admin/_actions/settings'
import { AdminForm } from '@/components/admin/form'
import { PageHeader, Panel } from '@/components/admin/ui'
import { cn } from '@/lib/cn'
import { WEEKDAYS_RO, type SettingsSection, type StoreSettings } from '@/lib/settings-schema'
import { requireStaff } from '@/server/session'
import { getSettings } from '@/server/settings'

export const metadata = { title: 'Setări magazin' }

const NAV: [SettingsSection, string][] = [
  ['company', 'Firmă & contact'],
  ['hours', 'Program'],
  ['shipping', 'Livrare'],
  ['payments', 'Plăți'],
  ['policies', 'Retur & garanție'],
  ['vat', 'TVA'],
  ['announcement', 'Bară de anunț'],
  ['b2b', 'B2B'],
  ['booking', 'Programări'],
  ['seo', 'SEO'],
]

export default function Settings() {
  return (
    <Suspense fallback={<div className="skeleton h-[800px]" />}>
      <Sections />
    </Suspense>
  )
}

const get = (o: unknown, path: string): unknown => path.split('.').reduce<unknown>((a, k) => (a && typeof a === 'object' ? (a as Record<string, unknown>)[k] : undefined), o)

function make(s: StoreSettings) {
  const base = 'field h-11 text-[14.5px]'
  const T = ({ path, label, hint, wide, placeholder, type = 'text' }: { path: string; label: string; hint?: string; wide?: boolean; placeholder?: string; type?: string }) => (
    <label className={cn('flex flex-col gap-1.5', wide && 'sm:col-span-2')}>
      <span className="text-[13px] font-bold">{label}</span>
      <input name={path} type={type} defaultValue={String(get(s, path) ?? '')} placeholder={placeholder} className={base} />
      {hint ? <span className="text-[12.5px] text-graphite">{hint}</span> : null}
    </label>
  )
  const N = ({ path, label, suffix, money, step = 1, hint }: { path: string; label: string; suffix?: string; money?: boolean; step?: number | 'any'; hint?: string }) => {
    const v = get(s, path)
    return (
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-bold">{label}</span>
        <span className="relative flex items-center">
          <input name={path} type="number" step={step} defaultValue={v == null ? '' : money ? Number(v) / 100 : Number(v)} className={cn(base, 'w-full pr-12 tnum')} />
          {suffix ? <span className="pointer-events-none absolute right-3.5 text-[13px] text-graphite">{suffix}</span> : null}
        </span>
        {hint ? <span className="text-[12.5px] text-graphite">{hint}</span> : null}
      </label>
    )
  }
  const B = ({ path, label }: { path: string; label: string }) => (
    <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" name={path} defaultChecked={!!get(s, path)} className="size-4 accent-cobalt" /> {label}</label>
  )
  return { T, N, B }
}

async function Sections() {
  await requireStaff('settings:write')
  const s = await getSettings()
  const { T, N, B } = make(s)
  const grid = 'grid gap-4 sm:grid-cols-2'
  const form = (section: SettingsSection, children: React.ReactNode) => <AdminForm action={saveSettingsSection.bind(null, section)}>{children}</AdminForm>

  return (
    <>
      <PageHeader eyebrow="Platformă" title="Setări magazin">
        <p className="mt-2 max-w-2xl text-[14.5px] text-graphite">Datele de aici apar în footer, pe facturi, în e-mailuri, în datele structurate Google și în calculul livrării. Fiecare salvare intră în jurnalul de audit.</p>
      </PageHeader>
      <div className="grid gap-8 xl:grid-cols-[200px_1fr]">
        <nav aria-label="Secțiuni" className="hidden xl:block">
          <ul className="sticky top-20 flex flex-col gap-0.5 text-[14px]">
            {NAV.map(([k, l]) => <li key={k}><a href={`#${k}`} className="block rounded-xl px-3 py-1.5 text-ink-2 no-underline hover:bg-glass">{l}</a></li>)}
          </ul>
        </nav>
        <div className="flex min-w-0 flex-col gap-6">
          <Section id="company" title="Firmă & contact">
            {form('company', (
              <>
                <div className={grid}>
                  <T path="company.brand" label="Nume comercial" />
                  <T path="company.legalName" label="Denumire juridică" />
                  <T path="company.cui" label="CUI / CIF" placeholder="RO12345678" />
                  <T path="company.regCom" label="Nr. Registrul Comerțului" placeholder="J17/123/2020" />
                  <T path="company.euid" label="EUID" placeholder="ROONRC.J17/123/2020" />
                  <T path="company.email" label="E-mail public" type="email" />
                  <T path="company.phone" label="Telefon" type="tel" />
                  <T path="company.whatsapp" label="WhatsApp" type="tel" hint="Format internațional: 40712345678" />
                  <T path="company.address" label="Adresă showroom" wide />
                  <T path="company.city" label="Oraș" />
                  <T path="company.county" label="Județ" />
                  <T path="company.postalCode" label="Cod poștal" />
                  <T path="company.country" label="Țară (ISO)" />
                  <N path="company.geo.lat" label="Latitudine" step="any" hint="Pentru harta din pagina showroom și Google" />
                  <N path="company.geo.lng" label="Longitudine" step="any" />
                  <T path="company.mapsUrl" label="Link Google Maps" wide />
                  <T path="company.iban" label="IBAN" />
                  <T path="company.bank" label="Banca" />
                  <T path="company.medicalNotice" label="Mențiune dispozitive medicale" wide hint="ex. Distribuitor dispozitive medicale înregistrat ANMDMR nr. …" />
                  <T path="company.optometrist" label="Optometrist responsabil" wide hint="Nume, calificare — apare pe pagina de conformitate" />
                  <T path="company.social.instagram" label="Instagram (URL)" />
                  <T path="company.social.facebook" label="Facebook (URL)" />
                  <T path="company.social.tiktok" label="TikTok (URL)" />
                </div>
              </>
            ))}
          </Section>

          <Section id="hours" title="Program showroom" note="Programările online se generează din acest program. Zilele speciale (sărbători, inventar) se adaugă din Programări.">
            {form('hours', (
              <ul className="flex flex-col gap-2">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const h = s.hours.weekly.find((x) => x.day === d)
                  const closed = !h || 'closed' in h
                  return (
                    <li key={d} className="grid grid-cols-[110px_1fr_1fr_auto] items-center gap-3">
                      <span className="text-[14px] font-bold">{WEEKDAYS_RO[d]}</span>
                      <input type="time" name={`hours.${d}.open`} defaultValue={h && !('closed' in h) ? h.open : '10:00'} className="field h-10 text-[14px]" aria-label={`${WEEKDAYS_RO[d]} deschidere`} />
                      <input type="time" name={`hours.${d}.close`} defaultValue={h && !('closed' in h) ? h.close : '18:00'} className="field h-10 text-[14px]" aria-label={`${WEEKDAYS_RO[d]} închidere`} />
                      <label className="flex items-center gap-1.5 text-[13.5px]"><input type="checkbox" name={`hours.${d}.closed`} defaultChecked={closed} className="accent-cobalt" /> închis</label>
                    </li>
                  )
                })}
              </ul>
            ))}
          </Section>

          <Section id="shipping" title="Livrare">
            {form('shipping', (
              <>
                <div className={grid}>
                  <N path="shipping.freeThreshold" label="Transport gratuit de la" suffix="lei" money />
                  <N path="shipping.codFee" label="Taxă ramburs" suffix="lei" money hint="0 = fără taxă" />
                </div>
                {(['courier', 'easybox', 'pickup'] as const).map((m) => (
                  <fieldset key={m} className="rounded-2xl p-4 ring-1 ring-line-soft">
                    <legend className="px-1 text-[13px] font-bold">{m === 'courier' ? 'Curier' : m === 'easybox' ? 'easybox / lockere' : 'Ridicare din showroom'}</legend>
                    <div className="grid gap-4 sm:grid-cols-[auto_1fr_1fr_140px] sm:items-end">
                      <B path={`shipping.${m}.enabled`} label="Activ" />
                      <T path={`shipping.${m}.label`} label="Denumire" />
                      <T path={`shipping.${m}.eta`} label="Termen afișat" />
                      <N path={`shipping.${m}.price`} label="Preț" suffix="lei" money />
                    </div>
                    {m === 'courier' ? <div className="mt-3 max-w-xs"><T path="shipping.courier.carrier" label="Curier implicit" /></div> : null}
                  </fieldset>
                ))}
              </>
            ))}
          </Section>

          <Section id="payments" title="Plăți" note="Cheile procesatorilor se configurează în variabilele de mediu (vezi Lansare & integrări).">
            {form('payments', (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-end gap-6">
                  <B path="payments.card.enabled" label="Card online" />
                  <label className="flex flex-col gap-1.5"><span className="text-[13px] font-bold">Procesator</span>
                    <select name="payments.card.provider" defaultValue={s.payments.card.provider} className="field h-11 w-48 text-[14.5px]"><option value="netopia">Netopia</option><option value="stripe">Stripe</option></select>
                  </label>
                </div>
                <div className="flex flex-wrap items-end gap-6"><B path="payments.cod.enabled" label="Ramburs" /><div className="w-48"><N path="payments.cod.maxTotal" label="Ramburs până la" suffix="lei" money /></div></div>
                <B path="payments.transfer.enabled" label="Transfer bancar (ordin de plată)" />
                <B path="payments.store.enabled" label="Plată la ridicare, în showroom" />
              </div>
            ))}
          </Section>

          <Section id="policies" title="Retur, garanție, producție">
            {form('policies', (
              <div className="grid gap-4 sm:grid-cols-3">
                <N path="policies.returnDays" label="Zile retur" suffix="zile" hint="Minim legal 14 (OUG 34/2014)" />
                <N path="policies.warrantyMonths" label="Garanție" suffix="luni" hint="Conformitate: minim 24 luni" />
                <N path="policies.adaptationDays" label="Garanție de adaptare" suffix="zile" hint="Refacem lentilele dacă nu te obișnuiești" />
                <N path="policies.productionDaysMin" label="Execuție minim" suffix="zile" />
                <N path="policies.productionDaysMax" label="Execuție maxim" suffix="zile" />
              </div>
            ))}
          </Section>

          <Section id="vat" title="Cote TVA" note="Lentilele și ramele corective pot beneficia de cotă redusă / scutire (dispozitive medicale) — confirmă încadrarea cu contabilul, apoi alege clasa TVA pe fiecare produs.">
            {form('vat', (
              <div className="grid gap-4 sm:grid-cols-3">
                <N path="vat.standard" label="Standard" suffix="%" />
                <N path="vat.reduced" label="Redusă" suffix="%" />
                <N path="vat.exempt" label="Scutit" suffix="%" />
              </div>
            ))}
          </Section>

          <Section id="announcement" title="Bară de anunț">
            {form('announcement', (
              <div className="flex flex-col gap-4">
                <B path="announcement.enabled" label="Afișează bara de sus" />
                <div className={grid}>
                  <T path="announcement.text" label="Text" wide />
                  <T path="announcement.href" label="Link (opțional)" placeholder="/livrare-si-plata" />
                </div>
              </div>
            ))}
          </Section>

          <Section id="b2b" title="B2B">
            {form('b2b', (
              <div className="grid gap-4 sm:grid-cols-3">
                <N path="b2b.minOrder" label="Comandă minimă" suffix="lei" money />
                <T path="b2b.leadDays" label="Termen de livrare afișat" />
                <div className="self-end pb-3"><B path="b2b.showStock" label="Partenerii văd stocul exact" /></div>
              </div>
            ))}
          </Section>

          <Section id="booking" title="Programări online">
            {form('booking', (
              <div className="grid gap-4 sm:grid-cols-3">
                <N path="booking.slotStepMin" label="Pas grilă" suffix="min" />
                <N path="booking.leadTimeHours" label="Cel mai devreme peste" suffix="ore" />
                <N path="booking.horizonDays" label="Cu cât timp înainte" suffix="zile" />
              </div>
            ))}
          </Section>

          <Section id="seo" title="SEO">
            {form('seo', (
              <div className="grid gap-4">
                <T path="seo.titleSuffix" label="Sufix titlu" hint="Apare după titlul fiecărei pagini: „Rame de vedere | Sifra Vision”" />
                <label className="flex flex-col gap-1.5"><span className="text-[13px] font-bold">Descriere implicită</span><textarea name="seo.defaultDescription" rows={3} defaultValue={s.seo.defaultDescription} className="field h-auto py-2.5 text-[14.5px]" /></label>
              </div>
            ))}
          </Section>
        </div>
      </div>
    </>
  )
}

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <Panel title={title} className="scroll-mt-20">
      <div id={id} className="-mt-24 pt-24" />
      {note ? <p className="mb-4 text-[13.5px] text-graphite">{note}</p> : null}
      {children}
    </Panel>
  )
}
