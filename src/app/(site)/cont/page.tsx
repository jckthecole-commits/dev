import type { Metadata } from 'next'
import { and, desc, eq, gte, sql } from 'drizzle-orm'
import Link from 'next/link'
import { Suspense } from 'react'
import { deleteAccount, signOutAction } from '@/app/actions/account'
import { ProfileForm } from '@/components/account/profile-form'
import { Icon } from '@/components/icons'
import { db } from '@/lib/db'
import { appointment, order, partner, prescription, user } from '@/lib/db/schema'
import { decryptJson } from '@/lib/crypto'
import { formatDate, formatDateTime, formatPrice, formatTime } from '@/lib/format'
import { formatDiopter, type RxValues } from '@/lib/optics'
import { STATUS } from '@/lib/order-status'
import { formatPhone } from '@/lib/ro'
import { isStaff, requireUser } from '@/server/session'

export const metadata: Metadata = { title: 'Contul meu', robots: { index: false } }

export default function AccountPage() {
  return (
    <div className="container-x pb-16 pt-10">
      <Suspense fallback={<div className="grid gap-5"><div className="skeleton h-24 w-2/3" /><div className="skeleton h-80" /></div>}>
        <Account />
      </Suspense>
    </div>
  )
}

async function Account() {
  const u = await requireUser('/cont')
  const [orders, rx, appts, me, prt] = await Promise.all([
    db.select().from(order).where(eq(order.userId, u.id)).orderBy(desc(order.createdAt)).limit(20),
    db.select().from(prescription).where(eq(prescription.userId, u.id)).orderBy(desc(prescription.createdAt)).limit(10),
    db.query.appointment.findMany({ where: and(eq(appointment.userId, u.id), gte(appointment.startsAt, sql`now() - interval '30 days'`)), with: { service: true }, orderBy: desc(appointment.startsAt), limit: 10 }),
    db.query.user.findFirst({ where: eq(user.id, u.id) }),
    db.query.partner.findFirst({ where: eq(partner.userId, u.id) }),
  ])
  const first = u.name.split(' ')[0]
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow">Contul meu · {u.email}</div>
          <h1 className="disp mt-3 text-[clamp(44px,6vw,84px)]">Bună, {first}.</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {isStaff(u.role) ? (
            <Link href="/admin" className="btn btn-ink btn-sm">
              <Icon name="grid" size={18} /> Panou de administrare
            </Link>
          ) : null}
          {prt?.status === 'approved' ? (
            <Link href="/b2b/portal" className="btn btn-primary btn-sm">
              <Icon name="building" size={18} /> Portal parteneri
            </Link>
          ) : null}
          <form action={signOutAction}>
            <button className="btn btn-secondary btn-sm">
              <Icon name="logout" size={18} /> Ieși din cont
            </button>
          </form>
        </div>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="card bg-glass p-6" aria-labelledby="comenzi">
          <h2 id="comenzi" className="text-[19px] font-bold">Comenzi</h2>
          {orders.length ? (
            <ul className="mt-4 divide-y divide-line">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/comanda/${o.number}`} className="flex items-center justify-between gap-4 py-4 no-underline hover:bg-fog/50">
                    <span>
                      <span className="block font-mono text-[14px] font-medium">{o.number}</span>
                      <span className="spec">{formatDateTime(o.createdAt)}</span>
                    </span>
                    <span className="flex items-center gap-4">
                      <span className="rounded-full bg-paper px-3 py-1 text-[12.5px] font-bold ring-1 ring-line-soft">{STATUS[o.status].label}</span>
                      <span className="w-20 text-right font-bold tnum">{formatPrice(o.total)}</span>
                      <Icon name="chevron-right" size={18} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-graphite">
              Nicio comandă încă. <Link href="/rame-de-vedere" className="text-cobalt underline">Alege o ramă</Link>.
            </p>
          )}
        </section>

        <section className="card bg-glass p-6" aria-labelledby="retete">
          <h2 id="retete" className="flex items-center gap-2 text-[19px] font-bold">
            Rețete <Icon name="lock" size={16} className="text-graphite" />
          </h2>
          {rx.length ? (
            <ul className="mt-4 flex flex-col gap-3">
              {rx.map((r) => {
                const v = r.dataEnc ? decryptJson<RxValues>(r.dataEnc) : null
                return (
                  <li key={r.id} className="rounded-xl bg-paper p-4 ring-1 ring-line-soft">
                    <div className="flex items-center justify-between">
                      <span className="spec">{formatDate(r.createdAt)}</span>
                      <span className={`text-[12.5px] font-bold ${r.status === 'verified' ? 'text-ok' : 'text-graphite'}`}>{r.status === 'verified' ? 'verificată' : r.status === 'needs_info' ? 'necesită clarificări' : 'în verificare'}</span>
                    </div>
                    {v ? (
                      <div className="mt-2 grid grid-cols-[auto_1fr_1fr_1fr] gap-x-3 font-mono text-[13px] tnum">
                        <span className="text-graphite">OD</span>
                        <span>{formatDiopter(v.od.sph)}</span>
                        <span>{formatDiopter(v.od.cyl)}</span>
                        <span>{v.od.axis ?? '—'}°</span>
                        <span className="text-graphite">OS</span>
                        <span>{formatDiopter(v.os.sph)}</span>
                        <span>{formatDiopter(v.os.cyl)}</span>
                        <span>{v.os.axis ?? '—'}°</span>
                      </div>
                    ) : (
                      <p className="mt-2 text-[13.5px] text-graphite">Poză / PDF încărcat</p>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="mt-3 text-[14.5px] text-graphite">Rețetele trimise la comenzi apar aici, criptate.</p>
          )}
        </section>

        <section className="card bg-glass p-6" aria-labelledby="programari">
          <div className="flex items-center justify-between">
            <h2 id="programari" className="text-[19px] font-bold">Programări</h2>
            <Link href="/programare" className="text-[14px] font-bold text-cobalt">
              Programare nouă
            </Link>
          </div>
          {appts.length ? (
            <ul className="mt-4 flex flex-col gap-2">
              {appts.map((a) => (
                <li key={a.id}>
                  <Link href={`/programare/${a.manageToken}`} className="flex items-center justify-between rounded-xl bg-paper px-4 py-3 no-underline ring-1 ring-line-soft">
                    <span>
                      <span className="block font-bold">{a.service.name}</span>
                      <span className="spec">
                        {formatDate(a.startsAt, { weekday: 'short', day: 'numeric', month: 'short' })} · {formatTime(a.startsAt)}
                      </span>
                    </span>
                    <span className="text-[12.5px] text-graphite">{a.status === 'cancelled' ? 'anulată' : a.status === 'completed' ? 'finalizată' : 'confirmată'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[14.5px] text-graphite">Nicio programare.</p>
          )}
        </section>

        <section className="card bg-glass p-6" aria-labelledby="profil">
          <h2 id="profil" className="text-[19px] font-bold">Profil</h2>
          <div className="mt-4">
            <ProfileForm name={me?.name ?? ''} phone={me?.phone ? formatPhone(me.phone) : ''} marketing={!!me?.marketingConsent} />
          </div>
        </section>

        <section className="card bg-glass p-6 lg:col-span-2" aria-labelledby="date">
          <h2 id="date" className="text-[19px] font-bold">Datele tale (GDPR)</h2>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-[14.5px] text-ink-2">Descarcă tot ce știm despre tine — comenzi, rețete, programări — într-un fișier JSON.</p>
              <a href="/api/private/export" className="btn btn-secondary btn-sm mt-3">
                <Icon name="download" size={18} /> Exportă datele
              </a>
            </div>
            <form action={deleteAccount}>
              <p className="text-[14.5px] text-ink-2">Ștergerea contului elimină rețetele, adresele și accesul. Facturile se păstrează anonimizat 10 ani (obligație legală).</p>
              <div className="mt-3 flex gap-2">
                <input name="confirm" placeholder="Scrie ȘTERGE" aria-label="Confirmare ștergere cont" className="field h-10 max-w-[180px]" />
                <button className="btn btn-sm bg-err text-white hover:bg-[#8c1f1f]">Șterge contul</button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </>
  )
}
