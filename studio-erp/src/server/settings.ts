import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { setting } from '@/lib/db/schema'

export type Settings = { studioName: string; usdToRonE4: number }
const DEFAULTS: Settings = { studioName: 'Studio', usdToRonE4: 46000 }

export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(setting)
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<Settings>
  return { ...DEFAULTS, ...map }
}

export async function saveSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  await db.insert(setting).values({ key, value }).onConflictDoUpdate({ target: setting.key, set: { value, updatedAt: new Date() } })
}

export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
  const row = await db.query.setting.findFirst({ where: eq(setting.key, key) })
  return (row?.value as Settings[K] | undefined) ?? DEFAULTS[key]
}
