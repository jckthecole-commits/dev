import { and, eq, ilike, or, sql } from 'drizzle-orm'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge, Card, Empty, Input, LinkButton, PageHeader, Select, Table } from '@/components/ui'
import { currentMonth, monthRange } from '@/lib/dates'
import { db } from '@/lib/db'
import { earning, model, user } from '@/lib/db/schema'
import { formatUsd } from '@/lib/money'
import { can } from '@/lib/roles'
import { modelScope } from '@/server/scope'
import { requirePermission } from '@/server/session'
import { MODEL_STATUS, type ModelStatus } from './status'

export const metadata: Metadata = { title: 'Modele' }

export default async function ModelsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const me = await requirePermission('models:read')
  const { q = '', status = 'current' } = await searchParams
  const { first, last } = monthRange(currentMonth())
  const showMoney = can(me.role, 'earnings:read')
  // subqueries use their own aliases: drizzle leaves columns unqualified in a single-table select
  const trainer = sql<string | null>`(select u.name from ${user} u where u.id = "model"."trainer_id")`.as('trainer_name')

  const statusFilter =
    status === 'current' ? sql`${model.status} in ('onboarding','active','paused')` : status in MODEL_STATUS ? eq(model.status, status as ModelStatus) : undefined
  const search = q.trim() ? or(ilike(model.stageName, `%${q.trim()}%`), ilike(model.legalName, `%${q.trim()}%`)) : undefined

  const rows = await db
    .select({
      id: model.id,
      stageName: model.stageName,
      legalName: model.legalName,
      status: model.status,
      trainer,
      monthCents: sql<number>`coalesce((select sum(e.amount_cents) from ${earning} e where e.model_id = "model"."id" and e.day between ${first} and ${last}), 0)::int`,
    })
    .from(model)
    .where(and(modelScope(me), statusFilter, search))
    .orderBy(sql`lower(${model.stageName})`)

  return (
    <>
      <PageHeader
        title="Modele"
        subtitle={me.role === 'trainer' ? 'Modelele pe care le ai în grijă.' : `${rows.length} ${rows.length === 1 ? 'model' : 'modele'}`}
        actions={can(me.role, 'models:write') ? <LinkButton href="/modele/nou" variant="primary">Adaugă model</LinkButton> : null}
      />
      <Card>
        <form className="mb-4 flex flex-wrap gap-2">
          <Input name="q" defaultValue={q} placeholder="Caută după nume…" className="max-w-xs flex-1" />
          <Select name="status" defaultValue={status} className="w-auto">
            <option value="current">Actuale</option>
            {Object.entries(MODEL_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
            <option value="all">Toate</option>
          </Select>
          <button className="h-10 rounded-lg border border-line bg-panel-2 px-4 text-sm">Filtrează</button>
        </form>
        {rows.length === 0 ? (
          <Empty>Niciun model găsit.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Nume de scenă</th>
                {me.role !== 'trainer' ? <th>Nume din acte</th> : null}
                <th>Status</th>
                <th>Trainer</th>
                {showMoney ? <th className="text-right">Luna aceasta</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/modele/${r.id}`} className="font-medium text-accent hover:underline">{r.stageName}</Link>
                  </td>
                  {me.role !== 'trainer' ? <td>{r.legalName}</td> : null}
                  <td><Badge tone={MODEL_STATUS[r.status].tone}>{MODEL_STATUS[r.status].label}</Badge></td>
                  <td className="text-muted">{r.trainer ?? '—'}</td>
                  {showMoney ? <td className="tabular text-right">{formatUsd(r.monthCents)}</td> : null}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  )
}
