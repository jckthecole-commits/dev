import type { PayoutTier } from './db/schema'

export type PayoutMode = 'whole' | 'progressive'
export type Plan = { name: string; mode: PayoutMode; tiers: PayoutTier[] }
export type AdjustmentTotals = { bonusCents: number; advanceCents: number; deductionCents: number }

export type PayLine = AdjustmentTotals & {
  grossCents: number
  /** effective percentage of the gross (for progressive plans, the blended rate) */
  percentBp: number
  shareCents: number
  netCents: number
  netBani: number
}

/** Tiers must start at 0, rise strictly, and stay within 0–100%. Returns an error message or null. */
export function validateTiers(tiers: PayoutTier[]): string | null {
  if (tiers.length === 0) return 'Adaugă cel puțin un prag.'
  if (tiers[0]!.fromCents !== 0) return 'Primul prag trebuie să înceapă de la 0.'
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i]!
    if (!Number.isInteger(t.fromCents) || t.fromCents < 0) return 'Pragurile trebuie să fie sume pozitive.'
    if (!Number.isInteger(t.percentBp) || t.percentBp < 0 || t.percentBp > 10000) return 'Procentele trebuie să fie între 0 și 100.'
    if (i > 0 && t.fromCents <= tiers[i - 1]!.fromCents) return 'Pragurile trebuie să fie în ordine crescătoare, fără dubluri.'
  }
  return null
}

/** The model's share of a month's gross under a plan. Rounds once, to the nearest cent. */
export function computeShare(grossCents: number, plan: Pick<Plan, 'mode' | 'tiers'>): { shareCents: number; percentBp: number } {
  if (grossCents <= 0 || plan.tiers.length === 0) return { shareCents: 0, percentBp: plan.tiers[0]?.percentBp ?? 0 }
  const tiers = [...plan.tiers].sort((a, b) => a.fromCents - b.fromCents)
  if (plan.mode === 'whole') {
    const tier = tiers.findLast((t) => t.fromCents <= grossCents) ?? tiers[0]!
    return { shareCents: Math.round((grossCents * tier.percentBp) / 10000), percentBp: tier.percentBp }
  }
  // progressive: sum each bracket's slice in cent·basis-points, round at the end
  let acc = 0
  for (let i = 0; i < tiers.length; i++) {
    const from = tiers[i]!.fromCents
    if (grossCents <= from) break
    const to = Math.min(grossCents, tiers[i + 1]?.fromCents ?? Infinity)
    acc += (to - from) * tiers[i]!.percentBp
  }
  const shareCents = Math.round(acc / 10000)
  return { shareCents, percentBp: Math.round(acc / grossCents) }
}

/** Converts US cents to RON bani at a rate of RON per USD × 10 000. */
export const usdToBani = (cents: number, usdToRonE4: number) => Math.round((cents * usdToRonE4) / 10000)

export function computePayLine(grossCents: number, plan: Pick<Plan, 'mode' | 'tiers'>, adj: AdjustmentTotals, usdToRonE4: number): PayLine {
  const { shareCents, percentBp } = computeShare(grossCents, plan)
  const netCents = shareCents + adj.bonusCents - adj.advanceCents - adj.deductionCents
  return { grossCents, percentBp, shareCents, ...adj, netCents, netBani: usdToBani(netCents, usdToRonE4) }
}

/** Human description of a plan, e.g. "50% · 55% de la $5.000,00". */
export function describeTiers(tiers: PayoutTier[], fmt: (cents: number) => string): string {
  return tiers.map((t, i) => (i === 0 ? `${t.percentBp / 100}%` : `${t.percentBp / 100}% de la ${fmt(t.fromCents)}`)).join(' · ')
}
