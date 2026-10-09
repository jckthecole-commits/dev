'use server'

import { refresh, updateTag } from 'next/cache'
import { db } from '@/lib/db'
import { setting } from '@/lib/db/schema'
import { DEFAULT_SETTINGS, SETTINGS_SECTIONS, type DayHours, type SettingsSection } from '@/lib/settings-schema'
import { audit } from '@/server/audit'
import { requireStaff } from '@/server/session'
import { getSettings } from '@/server/settings'

type R = { ok: boolean; message?: string; error?: string; fieldErrors?: Record<string, string> }

/** Money fields are edited in lei and stored in bani. */
const MONEY = new Set(['shipping.freeThreshold', 'shipping.courier.price', 'shipping.easybox.price', 'shipping.pickup.price', 'shipping.codFee', 'payments.cod.maxTotal', 'b2b.minOrder'])
const NULLABLE_NUM = new Set(['company.geo.lat', 'company.geo.lng'])
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Rebuild a section from the form, walking the defaults so every field is
 * coerced to the right type (checkbox → boolean, number, string).
 */
function readSection(section: SettingsSection, fd: FormData, errors: Record<string, string>) {
  const walk = (base: unknown, path: string): unknown => {
    if (Array.isArray(base)) return base
    if (base && typeof base === 'object') return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, walk(v, `${path}.${k}`)]))
    const raw = fd.get(path)
    if (typeof base === 'boolean') return fd.has(path)
    if (typeof base === 'number' || NULLABLE_NUM.has(path)) {
      const s = String(raw ?? '').trim().replace(',', '.')
      if (s === '' && NULLABLE_NUM.has(path)) return null
      const n = Number(s)
      if (!Number.isFinite(n) || (n < 0 && !NULLABLE_NUM.has(path))) {
        errors[path] = 'Număr invalid'
        return base
      }
      return MONEY.has(path) ? Math.round(n * 100) : n
    }
    return String(raw ?? '').trim()
  }
  return walk(DEFAULT_SETTINGS[section], section) as Record<string, unknown>
}

export async function saveSettingsSection(section: SettingsSection, _: unknown, fd: FormData): Promise<R> {
  const me = await requireStaff('settings:write')
  if (!SETTINGS_SECTIONS.includes(section)) return { ok: false, error: 'Secțiune necunoscută.' }
  const errors: Record<string, string> = {}
  let value: unknown
  if (section === 'hours') {
    const weekly: DayHours[] = [0, 1, 2, 3, 4, 5, 6].map((day) => {
      if (fd.has(`hours.${day}.closed`)) return { day, closed: true as const }
      const open = String(fd.get(`hours.${day}.open`) ?? '')
      const close = String(fd.get(`hours.${day}.close`) ?? '')
      if (!HHMM.test(open) || !HHMM.test(close) || open >= close) errors[`ziua ${day}`] = 'Interval orar invalid'
      return { day, open, close }
    })
    value = { weekly }
  } else if (section === 'launch') {
    value = { confirmed: fd.getAll('confirmed').map(String).slice(0, 30) }
  } else {
    value = readSection(section, fd, errors)
  }
  if (section === 'company') {
    const c = value as { email: string; cui: string }
    if (c.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email)) errors['company.email'] = 'E-mail invalid'
    if (c.cui && !/^(RO)?\d{2,10}$/i.test(c.cui.replace(/\s/g, ''))) errors['company.cui'] = 'CUI invalid'
  }
  if (Object.keys(errors).length) return { ok: false, error: 'Verifică câmpurile.', fieldErrors: errors }
  const before = (await getSettings())[section]
  await db.insert(setting).values({ key: section, value, updatedBy: me.id }).onConflictDoUpdate({ target: setting.key, set: { value, updatedAt: new Date(), updatedBy: me.id } })
  await audit(me, 'settings.update', 'setting', section, { before, after: value })
  updateTag('settings')
  refresh()
  return { ok: true, message: 'Salvat. Site-ul folosește noile valori.' }
}
