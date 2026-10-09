/**
 * Optics domain: prescription parsing/validation, lens index recommendation
 * and lens thickness estimation. Pure functions — shared by client & server.
 */

export type EyeRx = {
  sph: number
  cyl: number
  axis: number | null
  add: number | null
}

export type PdValue = { mode: 'single'; value: number } | { mode: 'dual'; right: number; left: number }

export type RxValues = {
  od: EyeRx // right eye (oculus dexter)
  os: EyeRx // left eye (oculus sinister)
  pd: PdValue
  notes?: string
}

export type RxIssue = { field: string; level: 'error' | 'warning'; message: string }

export const RX_LIMITS = {
  sph: { min: -20, max: 20, step: 0.25 },
  cyl: { min: -6, max: 6, step: 0.25 },
  axis: { min: 0, max: 180 },
  add: { min: 0.75, max: 3.5, step: 0.25 },
  pdSingle: { min: 50, max: 80 },
  pdDual: { min: 25, max: 40 },
} as const

/** Accepts "−1,25", "-1.25", "+0.5", "pl", "plan", "" → number | null */
export function parseDiopter(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null
  if (typeof input === 'number') return Number.isFinite(input) ? input : null
  const raw = input.trim().toLowerCase().replace(/\s+/g, '')
  if (raw === '') return null
  if (['pl', 'plan', 'plano', 'inf', '∞'].includes(raw)) return 0
  const normal = raw.replace(/[−–—]/g, '-').replace(',', '.')
  if (!/^[+-]?\d{0,2}(\.\d{1,2})?$/.test(normal) || normal === '+' || normal === '-') return null
  const n = Number(normal)
  return Number.isFinite(n) ? n : null
}

export function parseAxis(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || input === '') return null
  const n = typeof input === 'number' ? input : Number(String(input).replace(/[°\s]/g, ''))
  return Number.isInteger(n) ? n : null
}

export function parsePd(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || input === '') return null
  const n = typeof input === 'number' ? input : Number(String(input).replace(',', '.').replace(/mm/i, '').trim())
  return Number.isFinite(n) ? n : null
}

const onStep = (v: number, step: number) => Math.abs(v / step - Math.round(v / step)) < 1e-6

/** "−1,25" style formatting used across the UI. */
export function formatDiopter(v: number | null | undefined, opts: { plano?: boolean } = {}): string {
  if (v === null || v === undefined) return '—'
  if (v === 0) return opts.plano ? 'plan' : '0,00'
  const sign = v > 0 ? '+' : '−'
  return `${sign}${Math.abs(v).toFixed(2).replace('.', ',')}`
}

/** Convert plus-cylinder notation to minus-cylinder (the convention used by the lab). */
export function toMinusCyl(eye: EyeRx): EyeRx {
  if (eye.cyl <= 0 || eye.axis === null) return eye
  let axis = eye.axis + 90
  if (axis > 180) axis -= 180
  return { ...eye, sph: round2(eye.sph + eye.cyl), cyl: round2(-eye.cyl), axis }
}

/** Strongest meridian power (absolute value) — drives lens thickness. */
export function maxMeridianPower(eye: Pick<EyeRx, 'sph' | 'cyl'>): number {
  return Math.max(Math.abs(eye.sph), Math.abs(eye.sph + eye.cyl))
}

/** Spherical equivalent */
export function sphericalEquivalent(eye: Pick<EyeRx, 'sph' | 'cyl'>): number {
  return round2(eye.sph + eye.cyl / 2)
}

export function totalPd(pd: PdValue): number {
  return pd.mode === 'single' ? pd.value : pd.right + pd.left
}

export function validateRx(rx: RxValues, opts: { requiresAdd?: boolean } = {}): RxIssue[] {
  const issues: RxIssue[] = []
  const eyes: Array<['od' | 'os', EyeRx, string]> = [
    ['od', rx.od, 'ochiul drept (OD)'],
    ['os', rx.os, 'ochiul stâng (OS)'],
  ]
  for (const [key, eye, label] of eyes) {
    const { sph, cyl, axis, add } = eye
    if (!Number.isFinite(sph) || sph < RX_LIMITS.sph.min || sph > RX_LIMITS.sph.max || !onStep(sph, 0.25)) {
      issues.push({ field: `${key}.sph`, level: 'error', message: `SPH pentru ${label} trebuie să fie între −20,00 și +20,00, în pași de 0,25.` })
    }
    if (!Number.isFinite(cyl) || cyl < RX_LIMITS.cyl.min || cyl > RX_LIMITS.cyl.max || !onStep(cyl, 0.25)) {
      issues.push({ field: `${key}.cyl`, level: 'error', message: `CYL pentru ${label} trebuie să fie între −6,00 și +6,00, în pași de 0,25.` })
    }
    if (cyl !== 0) {
      if (axis === null || !Number.isInteger(axis) || axis < 0 || axis > 180) {
        issues.push({ field: `${key}.axis`, level: 'error', message: `Axul (AX) pentru ${label} este obligatoriu când există cilindru: 0–180°.` })
      }
    }
    if (Math.abs(cyl) > 4) {
      issues.push({ field: `${key}.cyl`, level: 'warning', message: `Cilindru mare la ${label}. Optometristul va verifica rețeta înainte de comandă.` })
    }
    if (opts.requiresAdd) {
      if (add === null || add < RX_LIMITS.add.min || add > RX_LIMITS.add.max || !onStep(add, 0.25)) {
        issues.push({ field: `${key}.add`, level: 'error', message: `ADD pentru ${label} este obligatoriu la lentile progresive / office: +0,75 … +3,50.` })
      }
    }
  }

  if (rx.pd.mode === 'single') {
    if (!Number.isFinite(rx.pd.value) || rx.pd.value < RX_LIMITS.pdSingle.min || rx.pd.value > RX_LIMITS.pdSingle.max) {
      issues.push({ field: 'pd', level: 'error', message: 'Distanța pupilară (PD) trebuie să fie între 50 și 80 mm.' })
    }
  } else {
    for (const side of ['right', 'left'] as const) {
      const v = rx.pd[side]
      if (!Number.isFinite(v) || v < RX_LIMITS.pdDual.min || v > RX_LIMITS.pdDual.max) {
        issues.push({ field: `pd.${side}`, level: 'error', message: 'PD monocular trebuie să fie între 25 și 40 mm pentru fiecare ochi.' })
      }
    }
  }

  const aniso = Math.abs(sphericalEquivalent(rx.od) - sphericalEquivalent(rx.os))
  if (aniso >= 2.5) {
    issues.push({
      field: 'os.sph',
      level: 'warning',
      message: 'Diferență mare între ochi (anizometropie). Te contactăm pentru recomandarea potrivită de lentile.',
    })
  }
  if (rx.od.sph === 0 && rx.od.cyl === 0 && rx.os.sph === 0 && rx.os.cyl === 0 && !opts.requiresAdd) {
    issues.push({ field: 'od.sph', level: 'warning', message: 'Rețeta are toate valorile 0 — dacă vrei lentile fără dioptrii, alege „Fără corecție”.' })
  }
  return issues
}

/* ──────────────────────────────────────────────────────────────────────────
   Lens index recommendation & thickness
   ────────────────────────────────────────────────────────────────────────── */

export type IndexCode = '1.50' | '1.60' | '1.67' | '1.74'

export const INDEX_DATA: Record<IndexCode, { n: number; minCenter: number; label: string }> = {
  '1.50': { n: 1.5, minCenter: 2.0, label: 'Standard' },
  '1.60': { n: 1.6, minCenter: 1.5, label: 'Subțiat' },
  '1.67': { n: 1.67, minCenter: 1.3, label: 'Extra-subțiat' },
  '1.74': { n: 1.74, minCenter: 1.2, label: 'Ultra-subțiat' },
}

export function recommendIndex(rx: Pick<RxValues, 'od' | 'os'> | null, frame: { rim: 'full' | 'semi' | 'rimless'; lensWidth?: number }, lensType = 'single'): IndexCode {
  const power = rx ? Math.max(maxMeridianPower(rx.od), maxMeridianPower(rx.os)) : 0
  let rec: IndexCode = power <= 2 ? '1.50' : power <= 4 ? '1.60' : power <= 6 ? '1.67' : '1.74'
  // Drilled / nylon-supported lenses need a tougher material than CR-39.
  if (frame.rim !== 'full' && rec === '1.50') rec = '1.60'
  // Large lenses with moderate power: thinner index pays off visually.
  if ((frame.lensWidth ?? 0) >= 55 && power > 1.5 && rec === '1.50') rec = '1.60'
  if (lensType === 'progressive' && rec === '1.74') rec = '1.67'
  return rec
}

/** Sag of a spherical surface of power `power` (D) at semi-diameter y (mm). */
function sag(power: number, n: number, y: number): number {
  if (power === 0) return 0
  const r = (1000 * (n - 1)) / Math.abs(power)
  if (y >= r) return r
  return r - Math.sqrt(r * r - y * y)
}

export type ThicknessEstimate = {
  index: IndexCode
  center: number
  edge: number
  /** The visibly thick part: edge for minus lenses, centre for plus lenses. */
  max: number
  kind: 'minus' | 'plus' | 'plano'
}

/**
 * Approximate thickness of the strongest lens for a given frame.
 * Uses the temporal semi-diameter including decentration:
 *   y = A/2 + ((A + DBL) − PD)/2
 */
export function estimateThickness(
  power: number,
  index: IndexCode,
  frame: { lensWidth: number; bridgeWidth: number },
  pd = 63,
): ThicknessEstimate {
  const { n, minCenter } = INDEX_DATA[index]
  const decentration = Math.max(0, (frame.lensWidth + frame.bridgeWidth - pd) / 2)
  const y = frame.lensWidth / 2 + decentration
  const s = sag(power, n, y)
  if (power < 0) {
    const center = minCenter
    const edge = center + s
    return { index, center: round1(center), edge: round1(edge), max: round1(edge), kind: 'minus' }
  }
  if (power > 0) {
    const edge = 1.0
    const center = Math.max(minCenter, edge + s)
    return { index, center: round1(center), edge, max: round1(center), kind: 'plus' }
  }
  return { index, center: minCenter, edge: minCenter, max: minCenter, kind: 'plano' }
}

/** Signed strongest power across both eyes (sign of the worst meridian). */
export function dominantPower(rx: Pick<RxValues, 'od' | 'os'>): number {
  const candidates = [rx.od.sph, rx.od.sph + rx.od.cyl, rx.os.sph, rx.os.sph + rx.os.cyl]
  return candidates.reduce((best, v) => (Math.abs(v) > Math.abs(best) ? v : best), 0)
}

export const emptyRx = (): RxValues => ({
  od: { sph: 0, cyl: 0, axis: null, add: null },
  os: { sph: 0, cyl: 0, axis: null, add: null },
  pd: { mode: 'single', value: 63 },
})

function round2(v: number) {
  return Math.round(v * 100) / 100
}
function round1(v: number) {
  return Math.round(v * 10) / 10
}
