import { isMonth } from '@/lib/dates'
import { formatPercent } from '@/lib/money'
import { can } from '@/lib/roles'
import { getPayroll } from '@/server/payroll'
import { getCurrentUser } from '@/server/session'

const cell = (v: string | number) => {
  const s = String(v)
  // quote, and neutralise spreadsheet formulas
  const safe = /^[=+\-@]/.test(s) && typeof v === 'string' ? `'${s}` : s
  return /[",;\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}
const money = (minor: number) => (minor / 100).toFixed(2)

export async function GET(_req: Request, { params }: { params: Promise<{ month: string }> }) {
  const me = await getCurrentUser()
  if (!me || !can(me.role, 'payroll:read')) return new Response('Forbidden', { status: 403 })
  const { month } = await params
  if (!isMonth(month)) return new Response('Not found', { status: 404 })
  const p = await getPayroll(month)
  const header = ['model', 'nume', 'plan', 'brut_usd', 'procent', 'cota_usd', 'bonus_usd', 'avans_usd', 'retineri_usd', 'net_usd', 'net_ron', 'stare']
  const lines = p.rows.map((r) =>
    [r.stageName, r.legalName, r.planName, money(r.grossCents), formatPercent(r.percentBp), money(r.shareCents), money(r.bonusCents), money(r.advanceCents), money(r.deductionCents), money(r.netCents), money(r.netBani), p.closed ? 'inchis' : 'provizoriu'].map(cell).join(','),
  )
  return new Response(`﻿${[header.join(','), ...lines].join('\r\n')}\r\n`, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="plati-${month}.csv"`, 'Cache-Control': 'private, no-store' },
  })
}
