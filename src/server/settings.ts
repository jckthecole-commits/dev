import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/lib/db'
import { setting } from '@/lib/db/schema'
import { mergeSettings, type SettingsSection, type StoreSettings } from '@/lib/settings-schema'

export async function getSettings(): Promise<StoreSettings> {
  'use cache'
  cacheTag('settings')
  cacheLife('hours')
  const rows = await db.select().from(setting)
  return mergeSettings(Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<Record<SettingsSection, unknown>>)
}
