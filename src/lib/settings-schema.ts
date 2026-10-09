/**
 * Store settings — typed, with defaults. Persisted per section in the `setting`
 * table (key = section name) and editable from /admin/setari.
 * Values marked "TODO go-live" are placeholders the owner must confirm.
 */

export type DayHours = { day: number; open: string; close: string } | { day: number; closed: true }

export type StoreSettings = {
  company: {
    brand: string
    legalName: string
    cui: string
    regCom: string
    euid: string
    address: string
    city: string
    county: string
    postalCode: string
    country: string
    phone: string
    whatsapp: string
    email: string
    iban: string
    bank: string
    /** Medical devices notice / registration (ANMDMR) shown in footer & trust page. */
    medicalNotice: string
    /** Responsible optometrist (shown on trust page). */
    optometrist: string
    geo: { lat: number | null; lng: number | null }
    mapsUrl: string
    social: { instagram: string; facebook: string; tiktok: string }
  }
  hours: { weekly: DayHours[] }
  shipping: {
    freeThreshold: number
    courier: { enabled: boolean; price: number; label: string; eta: string; carrier: string }
    easybox: { enabled: boolean; price: number; label: string; eta: string }
    pickup: { enabled: boolean; price: number; label: string; eta: string }
    codFee: number
  }
  payments: {
    card: { enabled: boolean; provider: 'netopia' | 'stripe' }
    cod: { enabled: boolean; maxTotal: number }
    transfer: { enabled: boolean }
    store: { enabled: boolean }
  }
  policies: {
    returnDays: number
    warrantyMonths: number
    adaptationDays: number
    productionDaysMin: number
    productionDaysMax: number
  }
  vat: { standard: number; reduced: number; exempt: number }
  announcement: { enabled: boolean; text: string; href: string }
  b2b: { minOrder: number; showStock: boolean; leadDays: string }
  booking: { slotStepMin: number; leadTimeHours: number; horizonDays: number }
  seo: { titleSuffix: string; defaultDescription: string }
  /** Go-live items the owner ticks by hand (no machine-checkable signal). */
  launch: { confirmed: string[] }
}

export const DEFAULT_SETTINGS: StoreSettings = {
  company: {
    brand: 'Sifra Vision',
    legalName: 'Sifra Vision SRL',
    cui: '',
    regCom: '',
    euid: '',
    address: 'Str. Alexandru Cernat 188',
    city: 'Galați',
    county: 'Galați',
    postalCode: '',
    country: 'RO',
    phone: '',
    whatsapp: '',
    email: 'contact@sifravision.ro',
    iban: '',
    bank: '',
    medicalNotice: '',
    optometrist: '',
    geo: { lat: null, lng: null },
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Str.+Alexandru+Cernat+188+Gala%C8%9Bi',
    social: { instagram: '', facebook: '', tiktok: '' },
  },
  hours: {
    weekly: [
      { day: 1, open: '10:00', close: '19:00' },
      { day: 2, open: '10:00', close: '19:00' },
      { day: 3, open: '10:00', close: '19:00' },
      { day: 4, open: '10:00', close: '19:00' },
      { day: 5, open: '10:00', close: '19:00' },
      { day: 6, open: '10:00', close: '14:00' },
      { day: 0, closed: true },
    ],
  },
  shipping: {
    freeThreshold: 30000,
    courier: { enabled: true, price: 1999, label: 'Curier la adresă', eta: '1–2 zile lucrătoare de la expediere', carrier: 'Sameday' },
    easybox: { enabled: true, price: 1499, label: 'easybox Sameday', eta: '1–2 zile lucrătoare de la expediere' },
    pickup: { enabled: true, price: 0, label: 'Ridicare din showroom Galați', eta: 'Te anunțăm când e gata' },
    codFee: 0,
  },
  payments: {
    card: { enabled: true, provider: 'netopia' },
    cod: { enabled: true, maxTotal: 300000 },
    transfer: { enabled: true },
    store: { enabled: true },
  },
  policies: { returnDays: 30, warrantyMonths: 24, adaptationDays: 30, productionDaysMin: 3, productionDaysMax: 6 },
  vat: { standard: 21, reduced: 11, exempt: 0 },
  announcement: {
    enabled: true,
    text: 'Livrare gratuită de la 300 lei · Fiecare rețetă e verificată de optometrist',
    href: '/livrare-si-plata',
  },
  b2b: { minOrder: 100000, showStock: true, leadDays: '24–48 h' },
  booking: { slotStepMin: 15, leadTimeHours: 2, horizonDays: 30 },
  seo: {
    titleSuffix: 'Sifra Vision',
    defaultDescription:
      'Rame de vedere și ochelari de soare cu lentile pe dioptria ta. Probă virtuală, preț complet calculat pe loc, rețetă verificată de optometrist. Showroom în Galați, livrare în toată România.',
  },
  launch: { confirmed: [] },
}

export type SettingsSection = keyof StoreSettings
export const SETTINGS_SECTIONS = Object.keys(DEFAULT_SETTINGS) as SettingsSection[]

/** Deep-merge stored JSON over defaults so new fields always have a value. */
export function mergeSettings(stored: Partial<Record<SettingsSection, unknown>>): StoreSettings {
  const out = structuredClone(DEFAULT_SETTINGS) as Record<string, unknown>
  for (const key of SETTINGS_SECTIONS) {
    const v = stored[key]
    if (v && typeof v === 'object') out[key] = deepMerge(out[key] as Record<string, unknown>, v as Record<string, unknown>)
  }
  return out as StoreSettings
}

function deepMerge(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
  const res: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(over)) {
    const b = base[k]
    if (v && typeof v === 'object' && !Array.isArray(v) && b && typeof b === 'object' && !Array.isArray(b)) {
      res[k] = deepMerge(b as Record<string, unknown>, v as Record<string, unknown>)
    } else if (v !== undefined) {
      res[k] = v
    }
  }
  return res
}

export const WEEKDAYS_RO = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'] as const

/** Go-live checklist derived from settings + environment. */
export function goLiveChecklist(s: StoreSettings, env: Record<string, string | undefined>) {
  const ok = (k: string) => s.launch.confirmed.includes(k)
  const items: { key: string; label: string; done: boolean; hint: string; href: string; manual?: boolean }[] = [
    { key: 'cui', label: 'CUI și nr. Registrul Comerțului', done: !!s.company.cui && !!s.company.regCom, hint: 'Obligatoriu pe site (ANPC) și pe facturi.', href: '/admin/setari#company' },
    { key: 'phone', label: 'Telefon de contact', done: !!s.company.phone, hint: 'Afișat în header, footer și în e-mailuri.', href: '/admin/setari#company' },
    { key: 'medical', label: 'Mențiune dispozitive medicale (ANMDMR)', done: !!s.company.medicalNotice, hint: 'Ramele și lentilele corective sunt dispozitive medicale clasa I (MDR 2017/745).', href: '/admin/setari#company' },
    { key: 'optometrist', label: 'Optometrist responsabil', done: !!s.company.optometrist, hint: 'Apare pe pagina „Conformitate și siguranță”.', href: '/admin/setari#company' },
    { key: 'hours', label: 'Program showroom confirmat', done: ok('hours'), manual: true, hint: 'Programul implicit este orientativ — confirmă-l (influențează programările).', href: '/admin/setari#hours' },
    { key: 'vat', label: 'Regim TVA confirmat cu contabilul', done: ok('vat'), manual: true, hint: 'Lentilele corective pot intra sub scutirea pentru proteze (art. 294 Cod fiscal). Setează clasa TVA pe produse.', href: '/admin/setari#vat' },
    { key: 'iban', label: 'IBAN pentru transfer bancar / B2B', done: !!s.company.iban, hint: 'Necesar dacă plata prin transfer este activă.', href: '/admin/setari#company' },
    { key: 'payments', label: 'Procesator de plăți card', done: !!(env.NETOPIA_API_KEY || env.STRIPE_SECRET_KEY), hint: 'Netopia (API v2) sau Stripe — cheile se pun în variabilele de mediu.', href: '/admin/integrari' },
    { key: 'smtp', label: 'Server e-mail (SMTP)', done: !!env.SMTP_HOST, hint: 'Fără SMTP, e-mailurile sunt salvate local în .data/outbox.', href: '/admin/integrari' },
    { key: 'invoice', label: 'Facturare & e-Factura (SmartBill)', done: !!(env.SMARTBILL_TOKEN && env.SMARTBILL_CIF), hint: 'Facturile se transmit în SPV în 5 zile lucrătoare.', href: '/admin/integrari' },
    { key: 'sal', label: 'Pictograma ANPC SAL (250×50 px)', done: ok('sal'), manual: true, hint: 'Ord. ANPC 270/2026: link către reclamatiisal.anpc.ro. Înlocuiește insigna din footer cu pictograma oficială.', href: '/admin/integrari' },
    { key: 'legal', label: 'Pagini legale revizuite de jurist', done: ok('legal'), manual: true, hint: 'Termeni, confidențialitate (inclusiv date medicale), retur.', href: '/admin/continut' },
    { key: 'photos', label: 'Fotografii reale de produs', done: ok('photos'), manual: true, hint: 'Randările procedurale sunt fidele dimensional; adaugă și fotografii.', href: '/admin/produse' },
  ]
  return items
}
