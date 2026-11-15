import { desc, lt } from 'drizzle-orm'
import type { Metadata } from 'next'
import { Card, Empty, LinkButton, PageHeader, Table } from '@/components/ui'
import { db } from '@/lib/db'
import { auditLog } from '@/lib/db/schema'
import { requirePermission } from '@/server/session'

export const metadata: Metadata = { title: 'Jurnal de audit' }

const PAGE = 100
const fmt = new Intl.DateTimeFormat('ro-RO', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Europe/Bucharest' })

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  await requirePermission('audit:read')
  const { before } = await searchParams
  const beforeDate = before && !Number.isNaN(Date.parse(before)) ? new Date(before) : undefined
  const rows = await db.select().from(auditLog).where(beforeDate ? lt(auditLog.createdAt, beforeDate) : undefined).orderBy(desc(auditLog.createdAt)).limit(PAGE)
  return (
    <>
      <PageHeader title="Jurnal de audit" subtitle="Cine a schimbat ce. Intrările nu se pot modifica din aplicație." />
      <Card>
        {rows.length === 0 ? (
          <Empty>Nimic înregistrat.</Empty>
        ) : (
          <Table>
            <thead><tr><th>Când</th><th>Cine</th><th>Acțiune</th><th>Obiect</th><th>Detalii</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="tabular whitespace-nowrap text-muted">{fmt.format(r.createdAt)}</td>
                  <td>{r.actorEmail ?? 'sistem'}</td>
                  <td className="font-mono text-xs">{r.action}</td>
                  <td className="font-mono text-xs text-muted">{r.entity}{r.entityId ? ` ${r.entityId.slice(0, 18)}` : ''}</td>
                  <td className="max-w-md truncate font-mono text-xs text-muted" title={r.data ? JSON.stringify(r.data) : ''}>{r.data ? JSON.stringify(r.data) : ''}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {rows.length === PAGE ? (
          <div className="mt-4"><LinkButton small href={`/audit?before=${encodeURIComponent(rows.at(-1)!.createdAt.toISOString())}`}>Mai vechi →</LinkButton></div>
        ) : null}
      </Card>
    </>
  )
}
