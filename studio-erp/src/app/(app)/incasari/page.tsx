import { and, asc, between, desc, eq, sql } from 'drizzle-orm'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge, Card, Empty, PageHeader, PeriodNav, Select, Stat, Table } from '@/components/ui'
import { addMonths, currentMonth, dayLabel, isMonth, monthLabel, monthRange, today } from '@/lib/dates'
import { db } from '@/lib/db'
import { earning, model, platform } from '@/lib/db/schema'
import { formatUsd } from '@/lib/money'
import { can } from '@/lib/roles'
import { isMonthClosed } from '@/server/payroll'
import { requirePermission } from '@/server/session'
import { deleteEarning, importEarnings, saveEarning } from './actions'
import { DeleteEarning, EarningForm, ImportForm } from './forms'

export const metadata: Metadata = { title: 'Încasări' }

const isUuid = (s?: string) => !!s && /^[0-9a-f-]{36}$/i.test(s)

export default async function EarningsPage({ searchParams }: { searchParams: Promise<{ m?: string; model?: string; platform?: string }> }) {
  const me = await requirePermission('earnings:read')
  const sp = await searchParams
  const month = isMonth(sp.m) ? sp.m : currentMonth()
  const modelId = isUuid(sp.model) ? sp.model : undefined
  const platformId = isUuid(sp.platform) ? sp.platform : undefined
  const { first, last } = monthRange(month)
  const inMonth = between(earning.day, first, last)
  const filters = and(inMonth, modelId ? eq(earning.modelId, modelId) : undefined, platformId ? eq(earning.platformId, platformId) : undefined)

  const [closed, models, platforms, byPlatform, rows, totals] = await Promise.all([
    isMonthClosed(month),
    db.select({ id: model.id, name: model.stageName, status: model.status }).from(model).orderBy(sql`lower(${model.stageName})`),
    db.select({ id: platform.id, name: platform.name, active: platform.active }).from(platform).orderBy(asc(platform.sort), asc(platform.name)),
    db
      .select({ name: platform.name, cents: sql<number>`sum(${earning.amountCents})::int` })
      .from(earning)
      .innerJoin(platform, eq(platform.id, earning.platformId))
      .where(filters)
      .groupBy(platform.name)
      .orderBy(sql`2 desc`),
    db
      .select({ id: earning.id, day: earning.day, cents: earning.amountCents, minutes: earning.minutes, source: earning.source, model: model.stageName, modelId: model.id, platform: platform.name })
      .from(earning)
      .innerJoin(model, eq(model.id, earning.modelId))
      .innerJoin(platform, eq(platform.id, earning.platformId))
      .where(filters)
      .orderBy(desc(earning.day), sql`lower(${model.stageName})`, asc(platform.name))
      .limit(500),
    db
      .select({ cents: sql<number>`coalesce(sum(${earning.amountCents}), 0)::int`, models: sql<number>`count(distinct ${earning.modelId})::int`, minutes: sql<number>`coalesce(sum(${earning.minutes}), 0)::int` })
      .from(earning)
      .where(filters),
  ])
  const t = totals[0]!
  const canWrite = can(me.role, 'earnings:write') && !closed
  const qs = (m: string) => `/incasari?m=${m}${modelId ? `&model=${modelId}` : ''}${platformId ? `&platform=${platformId}` : ''}`
  const now = today()
  const editableModels = models.filter((m) => m.status !== 'left').map(({ id, name }) => ({ id, name }))

  return (
    <>
      <PageHeader
        title="Încasări"
        subtitle={closed ? <Badge tone="neutral">Luna e închisă — doar citire</Badge> : 'Câștigul brut pe model, platformă și zi, în USD.'}
        actions={<PeriodNav prev={qs(addMonths(month, -1))} next={qs(addMonths(month, 1))} label={monthLabel(month)} current="/incasari" />}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Total brut" value={formatUsd(t.cents)} />
        <Stat label="Modele cu încasări" value={t.models} />
        <Stat label="Ore online" value={(t.minutes / 60).toLocaleString('ro-RO', { maximumFractionDigits: 1 })} hint="din rapoartele care au minute" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          <Card title="Înregistrări">
            <form className="mb-4 flex flex-wrap gap-2">
              <input type="hidden" name="m" value={month} />
              <Select name="model" defaultValue={modelId ?? ''} className="w-auto">
                <option value="">Toate modelele</option>
                {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
              <Select name="platform" defaultValue={platformId ?? ''} className="w-auto">
                <option value="">Toate platformele</option>
                {platforms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
              <button className="h-10 rounded-lg border border-line bg-panel-2 px-4 text-sm">Filtrează</button>
            </form>
            {rows.length === 0 ? (
              <Empty>Nicio încasare în {monthLabel(month)}.</Empty>
            ) : (
              <Table>
                <thead>
                  <tr><th>Ziua</th><th>Model</th><th>Platformă</th><th className="text-right">Sumă</th><th className="text-right">Minute</th><th>Sursă</th>{canWrite ? <th /> : null}</tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="capitalize whitespace-nowrap">{dayLabel(r.day)}</td>
                      <td><Link href={`/modele/${r.modelId}`} className="hover:underline">{r.model}</Link></td>
                      <td className="text-muted">{r.platform}</td>
                      <td className="tabular text-right">{formatUsd(r.cents)}</td>
                      <td className="tabular text-right text-muted">{r.minutes ?? '—'}</td>
                      <td className="text-xs text-muted">{r.source === 'csv' ? 'import' : 'manual'}</td>
                      {canWrite ? <td><DeleteEarning remove={deleteEarning.bind(null, r.id)} /></td> : null}
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            {rows.length === 500 ? <p className="mt-3 text-xs text-muted">Se văd primele 500 de rânduri; filtrează după model sau platformă.</p> : null}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Pe platforme">
            {byPlatform.length === 0 ? (
              <p className="text-sm text-muted">—</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {byPlatform.map((p) => (
                  <li key={p.name}>
                    <div className="flex justify-between"><span>{p.name}</span><span className="tabular">{formatUsd(p.cents)}</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-panel-2"><div className="h-full rounded-full bg-accent" style={{ width: `${t.cents ? (p.cents / t.cents) * 100 : 0}%` }} /></div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {canWrite ? (
            <>
              <Card title="Adaugă manual">
                {platforms.some((p) => p.active) ? (
                  <EarningForm
                    action={saveEarning}
                    models={editableModels}
                    platforms={platforms.filter((p) => p.active)}
                    defaultDay={now.startsWith(month) ? now : last}
                  />
                ) : (
                  <p className="text-sm text-muted">Adaugă întâi o platformă în Setări.</p>
                )}
              </Card>
              <Card title="Import din raport">
                <ImportForm action={importEarnings} />
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </>
  )
}
