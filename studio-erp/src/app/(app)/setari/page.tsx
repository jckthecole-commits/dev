import { asc } from 'drizzle-orm'
import type { Metadata } from 'next'
import { Card, PageHeader } from '@/components/ui'
import { shortTime } from '@/lib/dates'
import { db } from '@/lib/db'
import { payoutPlan, platform, room, shift } from '@/lib/db/schema'
import { formatRate, formatUsd } from '@/lib/money'
import { describeTiers } from '@/lib/payroll'
import { getSettings } from '@/server/settings'
import { requirePermission } from '@/server/session'
import { addNamed, addShift, savePlan, saveStudio, toggleNamed } from './actions'
import { NamedList, PlanCard, PlanForm, ShiftForm, StudioForm } from './forms'

export const metadata: Metadata = { title: 'Setări' }

const plain = (cents: number) => (cents / 100).toString().replace('.', ',')

export default async function SettingsPage() {
  await requirePermission('settings:write')
  const [settings, rooms, shifts, platforms, plans] = await Promise.all([
    getSettings(),
    db.select().from(room).orderBy(asc(room.sort), asc(room.name)),
    db.select().from(shift).orderBy(asc(shift.sort), asc(shift.startTime)),
    db.select().from(platform).orderBy(asc(platform.sort), asc(platform.name)),
    db.select().from(payoutPlan).orderBy(asc(payoutPlan.name)),
  ])
  return (
    <>
      <PageHeader title="Setări" />
      <div className="space-y-6">
        <Card title="Studio">
          <StudioForm action={saveStudio} studioName={settings.studioName} rate={formatRate(settings.usdToRonE4)} />
        </Card>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Camere">
            <NamedList items={rooms} add={addNamed.bind(null, 'room')} toggle={toggleNamed.bind(null, 'room')} placeholder="ex. Camera 4" />
          </Card>
          <Card title="Platforme">
            <NamedList items={platforms} add={addNamed.bind(null, 'platform')} toggle={toggleNamed.bind(null, 'platform')} placeholder="numele platformei" />
          </Card>
          <Card title="Ture">
            <ul className="mb-3 divide-y divide-line">
              {shifts.map((s) => (
                <li key={s.id} className={`flex justify-between py-2 text-sm ${s.active ? '' : 'text-muted line-through'}`}>
                  <span>{s.name}</span>
                  <span className="tabular text-muted">{shortTime(s.startTime)}–{shortTime(s.endTime)}</span>
                </li>
              ))}
            </ul>
            <ShiftForm action={addShift} />
          </Card>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Planuri de plată">
            {plans.length === 0 ? <p className="text-sm text-muted">Niciun plan. Creează unul ca să se poată calcula plățile.</p> : null}
            <ul className="-my-3 divide-y divide-line">
              {plans.map((p) => (
                <PlanCard key={p.id} name={p.name} isDefault={p.isDefault} summary={`${describeTiers(p.tiers, formatUsd)}${p.mode === 'progressive' ? ' · progresiv' : ''}`}>
                  <PlanForm
                    action={savePlan.bind(null, p.id)}
                    plan={{ name: p.name, mode: p.mode, isDefault: p.isDefault, tiers: p.tiers.map((t) => ({ from: plain(t.fromCents), pct: String(t.percentBp / 100).replace('.', ',') })) }}
                  />
                </PlanCard>
              ))}
            </ul>
          </Card>
          <Card title="Plan nou">
            <PlanForm action={savePlan.bind(null, null)} />
          </Card>
        </div>
      </div>
    </>
  )
}
