'use client'

import { useActionForm } from '@/lib/use-action-form'
import { useEffect, useState, useSyncExternalStore, useTransition } from 'react'
import { book, getAvailability } from '@/app/actions/booking'
import { Icon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/format'
import { addDays, weekdayOf, zonedDay } from '@/lib/time'

type Svc = { code: string; name: string; summary: string; durationMin: number; price: number }
const WD = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm']
const MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec']

export function Booking({ services, initialService }: { services: Svc[]; initialService?: string }) {
  const [svc, setSvc] = useState(services.find((s) => s.code === initialService)?.code ?? services[0]?.code ?? '')
  // "today" is only known in the browser (the page shell is prerendered)
  const today = useSyncExternalStore(subscribeNothing, browserToday, serverToday)
  const [startSel, setStart] = useState<string | null>(null)
  const start = startSel ?? today
  const [avail, setAvail] = useState<Record<string, string[]>>({})
  const [day, setDay] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const [loading, startLoad] = useTransition()
  const [state, onSubmit, pending] = useActionForm(book, null)
  const fe = state && !state.ok ? (state.fieldErrors ?? {}) : {}

  useEffect(() => {
    if (!start) return
    startLoad(async () => {
      const a = await getAvailability(svc, start, 14)
      setAvail(a)
      setDay((d) => (d && a[d]?.length ? d : (Object.entries(a).find(([, s]) => s.length)?.[0] ?? null)))
      setTime(null)
    })
  }, [svc, start])

  const service = services.find((s) => s.code === svc)
  const days = Object.keys(avail).sort()

  if (state?.ok) {
    return (
      <div className="card mx-auto flex max-w-xl flex-col items-center p-10 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-ok text-white">
          <Icon name="check" size={28} />
        </span>
        <h2 className="disp mt-6 text-[38px]">Ești programat.</h2>
        <p className="mt-3 text-[16px] text-ink-2">
          {service?.name} · {day && fmtDay(day)} · ora {time}. Ți-am trimis confirmarea pe e-mail, cu invitație pentru calendar.
        </p>
        <a href={`/programare/${state.token}`} className="btn btn-secondary mt-6">
          Vezi programarea
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <input type="hidden" name="service" value={svc} />
      <input type="hidden" name="day" value={day ?? ''} />
      <input type="hidden" name="time" value={time ?? ''} />
      <input type="text" name="website" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />
      <div className="flex flex-col gap-5">
        <section className="card bg-glass p-5 sm:p-6">
          <h2 className="mb-4 text-[18px] font-bold">Ce facem?</h2>
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Serviciu">
            {services.map((s) => (
              <button key={s.code} type="button" role="radio" aria-checked={svc === s.code} onClick={() => setSvc(s.code)} className={cn('flex flex-col items-start rounded-2xl p-4 text-left ring-1 transition-[box-shadow,background-color]', svc === s.code ? 'bg-cobalt-50 ring-[1.5px] ring-cobalt' : 'bg-paper ring-line hover:ring-graphite')}>
                <span className="text-[15.5px] font-bold">{s.name}</span>
                <span className="mt-1 text-[13px] leading-snug text-graphite">{s.summary}</span>
                <span className="spec mt-3">
                  {s.durationMin} min · {s.price ? formatPrice(s.price) : 'gratuit'}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="card bg-glass p-5 sm:p-6" aria-busy={loading}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[18px] font-bold">Când?</h2>
            <div className="flex gap-1">
              <button type="button" aria-label="Săptămâna anterioară" disabled={!start || !today || start <= today} onClick={() => setStart((s) => (!s || !today ? s : addDays(s, -14) < today ? today : addDays(s, -14)))} className="grid size-9 place-items-center rounded-full ring-1 ring-line disabled:opacity-30">
                <Icon name="chevron-left" size={18} />
              </button>
              <button type="button" aria-label="Săptămâna următoare" disabled={!start} onClick={() => setStart((s) => (s ? addDays(s, 14) : s))} className="grid size-9 place-items-center rounded-full ring-1 ring-line">
                <Icon name="chevron-right" size={18} />
              </button>
            </div>
          </div>
          <div className={cn('grid grid-cols-7 gap-2 transition-opacity', loading && 'opacity-50')}>
            {days.map((d) => {
              const n = avail[d]?.length ?? 0
              const [, m, dd] = d.split('-').map(Number) as [number, number, number]
              return (
                <button key={d} type="button" disabled={!n} aria-pressed={day === d} onClick={() => { setDay(d); setTime(null) }} className={cn('flex flex-col items-center rounded-xl py-2.5 ring-1 transition-colors disabled:opacity-35', day === d ? 'bg-ink text-fog ring-ink' : 'bg-paper ring-line hover:ring-graphite')}>
                  <span className="text-[11.5px] uppercase tracking-wide opacity-70">{WD[weekdayOf(d)]}</span>
                  <span className="text-[18px] font-bold tnum">{dd}</span>
                  <span className="text-[10.5px] opacity-70">{MONTHS[m - 1]}</span>
                </button>
              )
            })}
          </div>
          {day ? (
            <div className="mt-5">
              <div className="spec mb-2">{fmtDay(day)}</div>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Ora">
                {(avail[day] ?? []).map((t) => (
                  <button key={t} type="button" role="radio" aria-checked={time === t} onClick={() => setTime(t)} className={cn('rounded-full px-4 py-2 font-mono text-[14px] ring-1 tnum', time === t ? 'bg-cobalt text-white ring-cobalt' : 'bg-paper ring-line hover:ring-graphite')}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ) : !start ? (
            <div className="mt-4 grid grid-cols-7 gap-2">{Array.from({ length: 14 }).map((_, i) => <div key={i} className="skeleton h-[74px]" />)}</div>
          ) : !loading ? (
            <p className="mt-4 text-[14px] text-graphite">Nu mai sunt intervale libere în aceste zile. Mergi la săptămâna următoare.</p>
          ) : null}
        </section>
      </div>

      <section className="card h-fit bg-glass p-5 sm:p-6 lg:sticky lg:top-24">
        <h2 className="text-[18px] font-bold">Datele tale</h2>
        <div className="mt-4 flex flex-col gap-3">
          <F name="name" label="Nume și prenume" autoComplete="name" error={fe.name} />
          <F name="phone" label="Telefon" type="tel" autoComplete="tel" error={fe.phone} />
          <F name="email" label="E-mail" type="email" autoComplete="email" error={fe.email} />
          <div>
            <label htmlFor="b-note" className="mb-1.5 block text-[14px] font-bold">
              Observații (opțional)
            </label>
            <textarea id="b-note" name="note" rows={3} maxLength={500} placeholder="De ex.: port progresive de 3 ani, văd neclar seara…" className="field h-auto py-3" />
          </div>
          <label className="flex items-start gap-3 text-[13.5px]">
            <input type="checkbox" name="consent" className="mt-0.5 size-4 accent-cobalt" />
            <span>Sunt de acord să fiu contactat(ă) în legătură cu programarea, conform politicii de confidențialitate.</span>
          </label>
          {fe.consent ? <p className="text-[13px] text-err">{fe.consent}</p> : null}
        </div>
        <div className="mt-5 rounded-2xl bg-paper p-4 text-[14px] ring-1 ring-line-soft">
          {service && day && time ? (
            <>
              <div className="font-bold">{service.name}</div>
              <div className="text-graphite">
                {fmtDay(day)} · ora {time} · {service.durationMin} min
              </div>
            </>
          ) : (
            <span className="text-graphite">Alege serviciul, ziua și ora.</span>
          )}
        </div>
        {state && !state.ok ? <p role="alert" className="mt-3 text-[14px] text-err">{state.error}</p> : null}
        <button type="submit" disabled={pending || !day || !time} className="btn btn-primary btn-lg mt-4 w-full">
          {pending ? 'Se confirmă…' : 'Confirmă programarea'}
        </button>
      </section>
    </form>
  )
}

function fmtDay(d: string) {
  const [y, m, dd] = d.split('-').map(Number) as [number, number, number]
  return new Intl.DateTimeFormat('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, dd)))
}

function F({ name, label, error, ...rest }: { name: string; label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={`b-${name}`} className="mb-1.5 block text-[14px] font-bold">
        {label}
      </label>
      <input id={`b-${name}`} name={name} aria-invalid={!!error} className="field" {...rest} />
      {error ? <p className="mt-1 text-[13px] text-err">{error}</p> : null}
    </div>
  )
}

const subscribeNothing = () => () => {}
const browserToday = () => zonedDay(new Date())
const serverToday = () => null
