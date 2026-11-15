/**
 * Base setup: rooms, shifts, a payout plan and default settings (only what's missing).
 *   pnpm db:seed
 * With --demo, also fictional staff, models, two months of earnings and this week's schedule,
 * all logins using the password "demo-parola-123". Never run --demo on the real database.
 */
import './env'
import { hashPassword } from 'better-auth/crypto'
import { drizzle } from 'drizzle-orm/postgres-js'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import * as s from '../src/lib/db/schema'
import { addDays, addMonths, currentMonth, monthDays, today, weekStart } from '../src/lib/dates'

const demo = process.argv.includes('--demo')
const client = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} })
const db = drizzle(client, { schema: s, casing: 'snake_case' })

try {
  await db.insert(s.setting).values([
    { key: 'studioName', value: demo ? 'Studio Demo' : 'Studio' },
    { key: 'usdToRonE4', value: 46000 },
  ]).onConflictDoNothing()
  await db.insert(s.room).values(['Camera 1', 'Camera 2', 'Camera 3', 'Camera 4'].map((name, i) => ({ name, sort: i }))).onConflictDoNothing()
  await db.insert(s.shift).values([
    { name: 'Dimineața', startTime: '06:00', endTime: '14:00', sort: 600 },
    { name: 'Ziua', startTime: '14:00', endTime: '22:00', sort: 1400 },
    { name: 'Noaptea', startTime: '22:00', endTime: '06:00', sort: 2200 },
  ]).onConflictDoNothing()
  await db.insert(s.payoutPlan).values([
    { name: 'Standard', mode: 'whole', isDefault: true, tiers: [{ fromCents: 0, percentBp: 5000 }, { fromCents: 500000, percentBp: 5500 }, { fromCents: 1000000, percentBp: 6000 }] },
  ]).onConflictDoNothing()
  console.log('✓ base setup')

  if (demo) {
    if (await db.query.model.findFirst()) {
      console.log('• demo data already present, skipping')
    } else {
      await seedDemo()
      console.log('✓ demo data — sign in as admin@demo.local / manager@demo.local / trainer@demo.local / luna@demo.local, password demo-parola-123')
    }
  }
} finally {
  await client.end()
}

async function seedDemo() {
  const password = await hashPassword('demo-parola-123')
  const login = async (name: string, email: string, role: string) => {
    const id = randomUUID()
    await db.insert(s.user).values({ id, name, email, role, emailVerified: true })
    await db.insert(s.account).values({ id: randomUUID(), accountId: id, providerId: 'credential', userId: id, password })
    return id
  }
  await login('Admin Demo', 'admin@demo.local', 'admin')
  await login('Maria Manager', 'manager@demo.local', 'manager')
  const trainer = await login('Teo Trainer', 'trainer@demo.local', 'trainer')
  const lunaUser = await login('Luna', 'luna@demo.local', 'model')

  const platforms = await db.insert(s.platform).values(['Platforma A', 'Platforma B', 'Platforma C'].map((name, i) => ({ name, sort: i }))).returning()
  await db.insert(s.payoutPlan).values({ name: 'Progresiv senior', mode: 'progressive', tiers: [{ fromCents: 0, percentBp: 5000 }, { fromCents: 300000, percentBp: 6000 }, { fromCents: 800000, percentBp: 7000 }] })

  const names: [string, string, 'active' | 'onboarding' | 'paused'][] = [
    ['Luna', 'Ioana Popescu', 'active'], ['Aria', 'Andreea Ionescu', 'active'], ['Nova', 'Bianca Marin', 'active'], ['Stella', 'Diana Stan', 'active'],
    ['Iris', 'Elena Dobre', 'active'], ['Maya', 'Florina Rusu', 'active'], ['Zara', 'Gabriela Matei', 'onboarding'], ['Vera', 'Irina Lungu', 'paused'],
  ]
  const models = await db
    .insert(s.model)
    .values(names.map(([stageName, legalName, status], i) => ({ stageName, legalName, status, startDate: addDays(today(), -400 + i * 37), trainerId: i % 2 === 0 ? trainer : null, userId: stageName === 'Luna' ? lunaUser : null, phone: `07${String(20000000 + i * 1234567).slice(0, 8)}` })))
    .returning()
  await db.insert(s.modelAlias).values({ modelId: models[0]!.id, platformId: platforms[0]!.id, username: 'LunaLight' })

  // deterministic pseudo-random so the demo looks the same each time
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const rows: (typeof s.earning.$inferInsert)[] = []
  const now = today()
  for (const month of [addMonths(currentMonth(), -1), currentMonth()]) {
    for (const day of monthDays(month)) {
      if (day > now) break
      models.forEach((m, mi) => {
        if (m.status !== 'active' || rnd() < 0.25) return
        platforms.forEach((p, pi) => {
          if (rnd() < 0.35) return
          const base = (6 - mi * 0.5) * (pi === 0 ? 1.4 : 0.7)
          rows.push({ modelId: m.id, platformId: p.id, day, amountCents: Math.round((40 + rnd() * 160) * base) * 100 + Math.round(rnd() * 99), minutes: 120 + Math.round(rnd() * 300), source: 'csv' })
        })
      })
    }
  }
  for (let i = 0; i < rows.length; i += 500) await db.insert(s.earning).values(rows.slice(i, i + 500))

  const rooms = await db.select().from(s.room)
  const shifts = await db.select().from(s.shift)
  const active = models.filter((m) => m.status === 'active')
  const monday = weekStart(now)
  const entries: (typeof s.scheduleEntry.$inferInsert)[] = []
  for (let d = 0; d < 7; d++) {
    shifts.slice(0, 2).forEach((sh, si) => {
      rooms.slice(0, 3).forEach((r, ri) => {
        const m = active[(d + si * 3 + ri) % active.length]!
        entries.push({ day: addDays(monday, d), roomId: r.id, shiftId: sh.id, modelId: m.id })
      })
    })
  }
  await db.insert(s.scheduleEntry).values(entries).onConflictDoNothing()
  await db.insert(s.adjustment).values({ modelId: models[1]!.id, month: currentMonth(), kind: 'advance', amountCents: 20000, note: 'avans' })
}
