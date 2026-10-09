/**
 * Seed: idempotent catalogue + content. `--demo` also creates demo staff,
 * customers, orders, bookings and B2B partners (for local dev / staging only).
 *
 *   pnpm db:seed           # catalogue, lenses, services, content, settings
 *   pnpm db:seed --demo    # + demo data
 */
import './env'
import { hashPassword } from 'better-auth/crypto'
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { randomBytes, randomUUID } from 'node:crypto'
import * as s from '../src/lib/db/schema'
import { DEFAULT_SETTINGS, SETTINGS_SECTIONS } from '../src/lib/settings-schema'
import { normalizeSearch, slugify } from '../src/lib/text'
import { encryptJson } from '../src/lib/crypto'
import { zonedToUtc, addDays, zonedDay } from '../src/lib/time'
import { ARTICLES, FAQS, PAGES } from './data/content'
import { LENS_INDICES, LENS_TREATMENTS, LENS_TYPES, PRODUCTS, SERVICES } from './data/catalog'

const DEMO = process.argv.includes('--demo')
const client = postgres(process.env.DATABASE_URL!, { max: 4, onnotice: () => {} })
const db = drizzle(client, { schema: s, casing: 'snake_case' })
const bani = (lei: number) => Math.round(lei * 100)
const t0 = Date.now()

/* ── settings ── */
for (const key of SETTINGS_SECTIONS) {
  await db.insert(s.setting).values({ key, value: DEFAULT_SETTINGS[key] }).onConflictDoNothing()
}

/* ── locations ── */
await db
  .insert(s.location)
  .values([
    { code: 'GL', name: 'Showroom Galați', kind: 'store', address: 'Str. Alexandru Cernat 188, Galați', sellable: true },
    { code: 'WH', name: 'Depozit central', kind: 'warehouse', address: 'Galați', sellable: true },
  ])
  .onConflictDoNothing()
const locations = await db.select().from(s.location)
const showroom = locations.find((l) => l.code === 'GL')!
const warehouse = locations.find((l) => l.code === 'WH')!

/* ── lens catalogue ── */
for (const [i, t] of LENS_TYPES.entries()) {
  const v = { ...t, price: bani(t.price), categories: [...t.categories], position: i }
  await db.insert(s.lensType).values(v).onConflictDoUpdate({ target: s.lensType.code, set: v })
}
for (const [i, x] of LENS_INDICES.entries()) {
  const v = { ...x, price: bani(x.price), lensTypes: [...x.lensTypes], position: i }
  await db.insert(s.lensIndex).values(v).onConflictDoUpdate({ target: s.lensIndex.code, set: v })
}
for (const [i, x] of LENS_TREATMENTS.entries()) {
  const v = { ...x, price: bani(x.price), categories: [...x.categories], lensTypes: [...x.lensTypes], position: i }
  await db.insert(s.lensTreatment).values(v).onConflictDoUpdate({ target: s.lensTreatment.code, set: v })
}

/* ── services ── */
for (const [i, x] of SERVICES.entries()) {
  const v = { ...x, position: i }
  await db.insert(s.service).values(v).onConflictDoUpdate({ target: s.service.code, set: v })
}

/* ── products ── */
const audienceLabel = { unisex: 'unisex', women: 'pentru femei', men: 'pentru bărbați', kids: 'pentru copii' }
const materialLabel = { acetat: 'acetat', metal: 'metal', titan: 'titan', tr90: 'TR90', combinat: 'acetat și metal' }
let position = 0
for (const p of PRODUCTS) {
  const name = `${p.family} ${p.a}`
  const slug = slugify(name)
  const modelCode = `${p.category === 'sun' ? 'SVS' : 'SV'}-${slugify(p.family).toUpperCase()}-${p.a}`
  const frameWidth = Math.round(2 * p.a + p.dbl + (p.material === 'metal' || p.material === 'titan' ? 8 : 10))
  const kind = p.category === 'sun' ? 'Ochelari de soare' : 'Rame de vedere'
  const description = `${p.story}\n\nDimensiuni ${p.a}□${p.dbl} ${p.temple}: lentila are ${p.a} mm lățime și ${p.b} mm înălțime, puntea ${p.dbl} mm, brațele ${p.temple} mm. Lățimea totală este de aproximativ ${frameWidth} mm, iar rama cântărește ${p.weight} g.`
  const highlights = [
    `${p.a}□${p.dbl} ${p.temple} · ${p.weight} g`,
    `Material: ${materialLabel[p.material]}`,
    p.b >= 28 && p.category === 'optical' ? 'Compatibilă cu lentile progresive' : null,
    p.polarized ? 'Lentile polarizate' : null,
    p.filterCategory ? `Categoria filtrului ${p.filterCategory} · UV400` : null,
  ].filter(Boolean) as string[]
  const values = {
    slug,
    name,
    family: p.family,
    modelCode,
    category: p.category,
    status: 'active' as const,
    audience: p.audience,
    shape: p.shape,
    material: p.material,
    rim: p.rim,
    lensWidth: p.a,
    bridgeWidth: p.dbl,
    templeLength: p.temple,
    lensHeight: p.b,
    frameWidth,
    weightGrams: p.weight,
    geometry: p.geometry,
    tagline: p.tagline,
    description,
    highlights,
    features: p.features,
    filterCategory: p.filterCategory ?? null,
    polarized: !!p.polarized,
    price: bani(p.price),
    compareAtPrice: p.compareAt ? bani(p.compareAt) : null,
    wholesalePrice: Math.round(bani(p.price) / 1.21 / 2.1 / 100) * 100,
    badge: p.badge ?? null,
    featured: !!p.featured,
    position: position++,
    manufacturer: 'Sifra Vision SRL',
    countryOfOrigin: p.material === 'acetat' ? 'Italia (acetat) · asamblare UE' : 'UE',
    ceMarking: p.category === 'sun' ? `CE · EN ISO 12312-1 · cat. ${p.filterCategory} · UV400` : 'CE · dispozitiv medical clasa I (MDR 2017/745)',
    searchText: normalizeSearch(
      [name, p.family, modelCode, kind, p.shape, p.material, materialLabel[p.material], audienceLabel[p.audience], p.tagline, ...p.variants.map((v) => v.color)].join(' '),
    ),
    metaTitle: `${name} — ${kind.toLowerCase()} ${materialLabel[p.material]} ${p.a}□${p.dbl}`,
    metaDescription: `${p.tagline} ${kind} ${name}, ${p.a}□${p.dbl} ${p.temple}, ${p.weight} g. Preț de la ${p.price} lei, cu lentile pe dioptria ta. Probă virtuală și showroom în Galați.`,
    publishedAt: new Date(Date.now() - (PRODUCTS.length - position) * 86400000 * 3),
  }
  const [row] = await db.insert(s.product).values(values).onConflictDoUpdate({ target: s.product.slug, set: values }).returning({ id: s.product.id })
  for (const [i, v] of p.variants.entries()) {
    const vv = {
      productId: row!.id,
      sku: `${modelCode}-${v.code}`,
      ean: null,
      colorName: v.color,
      colorSlug: slugify(v.color),
      colorFamily: v.family,
      swatch: v.swatch,
      position: i,
      isDefault: i === 0,
      active: true,
    }
    const [vr] = await db.insert(s.variant).values(vv).onConflictDoUpdate({ target: s.variant.sku, set: vv }).returning({ id: s.variant.id })
    for (const [loc, qty] of [
      [showroom, v.stock[0]],
      [warehouse, v.stock[1]],
    ] as const) {
      await db.insert(s.inventory).values({ variantId: vr!.id, locationId: loc.id, onHand: qty, reorderPoint: loc.kind === 'store' ? 2 : 5 }).onConflictDoNothing()
    }
  }
}

/* ── content ── */
let daysAgo = 40
for (const p of [...ARTICLES, ...PAGES]) {
  const v = {
    slug: p.slug,
    kind: p.kind,
    title: p.title,
    excerpt: p.excerpt,
    body: p.body,
    category: p.category ?? null,
    readingMinutes: p.readingMinutes ?? null,
    authorName: p.kind === 'article' ? 'Echipa Sifra Vision' : null,
    status: 'published' as const,
    metaDescription: p.metaDescription ?? p.excerpt,
    publishedAt: new Date(Date.now() - daysAgo-- * 86400000 * 4),
  }
  await db.insert(s.post).values(v).onConflictDoUpdate({ target: s.post.slug, set: v })
}
const faqCount = await db.select({ n: sql<number>`count(*)::int` }).from(s.faq)
if (faqCount[0]!.n === 0) await db.insert(s.faq).values(FAQS.map((f, i) => ({ ...f, position: i })))

console.log(`✓ catalogue: ${PRODUCTS.length} products, content: ${ARTICLES.length + PAGES.length} posts, ${FAQS.length} FAQs`)

/* ════════════════════════════════════════════════════════════════════════
   DEMO DATA
   ════════════════════════════════════════════════════════════════════════ */
if (DEMO) {
  const pw = process.env.DEMO_PASSWORD ?? 'sifra-demo-2026'
  const staff = [
    { email: 'admin@sifravision.ro', name: 'Administrator', role: 'admin' },
    { email: 'optometrist@sifravision.ro', name: 'Optometrist (demo)', role: 'optometrist' },
    { email: 'showroom@sifravision.ro', name: 'Showroom (demo)', role: 'staff' },
    { email: 'partener@example.com', name: 'Optica Demo Brăila', role: 'partner' },
    { email: 'client@example.com', name: 'Ana Popescu (demo)', role: 'customer' },
  ]
  const hashed = await hashPassword(pw)
  const ids: Record<string, string> = {}
  for (const u of staff) {
    const existing = await db.query.user.findFirst({ where: eq(s.user.email, u.email) })
    if (existing) {
      ids[u.email] = existing.id
      continue
    }
    const id = randomUUID()
    ids[u.email] = id
    await db.insert(s.user).values({ id, email: u.email, name: u.name, role: u.role, emailVerified: true })
    await db.insert(s.account).values({ id: randomUUID(), accountId: id, providerId: 'credential', userId: id, password: hashed })
  }

  // B2B partners
  await db
    .insert(s.partner)
    .values([
      {
        userId: ids['partener@example.com'],
        companyName: 'Optica Demo SRL',
        cui: 'RO00000001',
        regCom: 'J00/0000/2020',
        address: 'Str. Exemplu 1',
        city: 'Brăila',
        county: 'Brăila',
        contactName: 'Demo Partener',
        email: 'partener@example.com',
        phone: '0700 000 001',
        storesCount: 2,
        status: 'approved',
        tier: 'silver',
        discountPercent: 5,
        paymentTermsDays: 30,
        approvedAt: new Date(),
      },
      {
        companyName: 'Vision Test Iași SRL',
        cui: 'RO00000002',
        address: 'Bd. Exemplu 10',
        city: 'Iași',
        county: 'Iași',
        contactName: 'Solicitant Demo',
        email: 'cerere@example.com',
        phone: '0700 000 002',
        storesCount: 1,
        message: 'Am un cabinet de optică și vrem să listăm colecția SIFRA.',
        status: 'pending',
      },
    ])
    .onConflictDoNothing()

  await db
    .insert(s.coupon)
    .values([
      { code: 'BINEVENIT10', description: '10% la prima comandă', kind: 'percent', value: 10, minSubtotal: 20000 },
      { code: 'LIVRAREGRATUITA', description: 'Transport gratuit', kind: 'free_shipping', value: 0, minSubtotal: 0 },
    ])
    .onConflictDoNothing()

  // Orders over the last 60 days
  const orderCount = (await db.select({ n: sql<number>`count(*)::int` }).from(s.order))[0]!.n
  if (orderCount === 0) {
    const variants = await db.query.variant.findMany({ with: { product: true } })
    const types = await db.select().from(s.lensType)
    const idx = await db.select().from(s.lensIndex)
    const firstNames = ['Andrei', 'Maria', 'Ioana', 'Mihai', 'Elena', 'Cristian', 'Alexandra', 'George', 'Diana', 'Vlad', 'Irina', 'Bogdan']
    const lastNames = ['Popescu', 'Ionescu', 'Dumitru', 'Stan', 'Stoica', 'Gheorghe', 'Rusu', 'Munteanu', 'Matei', 'Constantin']
    const cities = [
      ['Galați', 'Galați'],
      ['București', 'București'],
      ['Brăila', 'Brăila'],
      ['Iași', 'Iași'],
      ['Constanța', 'Constanța'],
      ['Cluj-Napoca', 'Cluj'],
      ['Tecuci', 'Galați'],
      ['Focșani', 'Vrancea'],
    ]
    const statuses: (typeof s.orderStatus.enumValues)[number][] = ['delivered', 'delivered', 'delivered', 'shipped', 'in_lab', 'rx_review', 'placed', 'ready', 'qc', 'cancelled']
    const rnd = (n: number) => Math.floor(Math.random() * n)
    for (let i = 0; i < 64; i++) {
      const v = variants[rnd(variants.length)]!
      const p = v.product
      const fn = firstNames[rnd(firstNames.length)]!
      const ln = lastNames[rnd(lastNames.length)]!
      const [city, county] = cities[rnd(cities.length)]!
      const created = new Date(Date.now() - rnd(60 * 24) * 3600 * 1000)
      const ageDays = (Date.now() - created.getTime()) / 86400000
      let status = statuses[rnd(statuses.length)]!
      if (ageDays < 2) status = (['placed', 'rx_review'] as const)[rnd(2)]!
      if (ageDays > 12 && !['delivered', 'cancelled'].includes(status)) status = 'delivered'
      const withLens = p.category === 'optical' ? Math.random() < 0.85 : Math.random() < 0.2
      const typeCode = withLens ? (Math.random() < 0.25 ? 'progressive' : 'single') : 'none'
      const type = types.find((t) => t.code === typeCode)!
      const index = withLens ? idx[rnd(3)]! : null
      const lensTotal = withLens ? type.price + (index?.price ?? 0) + 9900 : 0
      const sub = p.price + lensTotal
      const shippingMethod = city === 'Galați' && Math.random() < 0.5 ? 'pickup' : Math.random() < 0.4 ? 'easybox' : 'courier'
      const ship = sub >= 30000 || shippingMethod === 'pickup' ? 0 : shippingMethod === 'easybox' ? 1499 : 1999
      const pm = (['card', 'card', 'cod', 'cod', 'transfer'] as const)[rnd(5)]
      const paid = status !== 'cancelled' && (pm === 'card' || ['delivered'].includes(status))
      const number = `SV-${created.getFullYear()}-${String(1000 + i).padStart(6, '0')}`
      let rxId: string | null = null
      if (withLens) {
        const sph = -(rnd(16) * 0.25)
        const [rx] = await db
          .insert(s.prescription)
          .values({
            source: 'manual',
            dataEnc: encryptJson({
              od: { sph, cyl: -0.5, axis: 180, add: type.code === 'progressive' ? 2 : null },
              os: { sph: sph + 0.25, cyl: -0.25, axis: 170, add: type.code === 'progressive' ? 2 : null },
              pd: { mode: 'single', value: 60 + rnd(8) },
            }),
            status: status === 'rx_review' || status === 'placed' ? 'pending' : 'verified',
            createdAt: created,
          })
          .returning({ id: s.prescription.id })
        rxId = rx!.id
      }
      const [o] = await db
        .insert(s.order)
        .values({
          number,
          accessToken: randomBytes(18).toString('base64url'),
          email: `${slugify(fn)}.${slugify(ln)}${i}@example.com`,
          phone: `07${String(10000000 + rnd(89999999))}`,
          customerName: `${fn} ${ln}`,
          status,
          paymentStatus: status === 'cancelled' ? (pm === 'card' ? 'refunded' : 'failed') : paid ? 'paid' : 'pending',
          paymentMethod: pm,
          paymentProvider: pm === 'card' ? 'netopia' : null,
          shippingMethod,
          shippingAddress: { name: `${fn} ${ln}`, phone: '0700000000', street: 'Str. Exemplu 12', city, county, country: 'RO' },
          subtotal: sub,
          shippingTotal: ship,
          vatTotal: Math.round((sub + ship) - (sub + ship) / 1.21),
          total: sub + ship,
          requiresRx: withLens,
          placedAt: created,
          paidAt: paid ? created : null,
          shippedAt: ['shipped', 'delivered'].includes(status) ? new Date(created.getTime() + 4 * 86400000) : null,
          deliveredAt: status === 'delivered' ? new Date(created.getTime() + 6 * 86400000) : null,
          awb: ['shipped', 'delivered'].includes(status) && shippingMethod !== 'pickup' ? `4EMGLN${100000000 + rnd(899999999)}` : null,
          carrier: shippingMethod === 'pickup' ? null : 'Sameday',
          createdAt: created,
          updatedAt: created,
        })
        .returning({ id: s.order.id })
      await db.insert(s.orderItem).values({
        orderId: o!.id,
        variantId: v.id,
        productId: p.id,
        productName: p.name,
        variantName: v.colorName,
        sku: v.sku,
        quantity: 1,
        unitPrice: sub,
        lineTotal: sub,
        vatRate: 21,
        configuration: { lensType: type.code, lensIndex: index?.code, treatments: withLens ? ['hardcoat', 'ar'] : [], rxMode: withLens ? 'manual' : undefined, prescriptionId: rxId ?? undefined },
        priceBreakdown: [
          { code: 'frame', label: `Rama ${p.name} · ${v.colorName}`, amount: p.price },
          ...(withLens ? [{ code: `type:${type.code}`, label: `Lentile ${type.name.toLowerCase()}`, amount: type.price }] : []),
        ],
        prescriptionId: rxId,
        frameSnapshot: { lensWidth: p.lensWidth, bridgeWidth: p.bridgeWidth, templeLength: p.templeLength, lensHeight: p.lensHeight, shape: p.shape },
      })
      await db.insert(s.orderEvent).values({ orderId: o!.id, kind: 'status', toStatus: 'placed', message: 'Comandă plasată', public: true, createdAt: created })
    }
  }

  // Appointments for the next days
  const apptCount = (await db.select({ n: sql<number>`count(*)::int` }).from(s.appointment))[0]!.n
  if (apptCount === 0) {
    const services = await db.select().from(s.service)
    const today = zonedDay(new Date())
    const plan: [number, string, string][] = [
      [0, '11:00', 'consult'],
      [0, '15:30', 'fitting'],
      [1, '10:30', 'consult'],
      [1, '12:00', 'adjust'],
      [2, '17:00', 'contact'],
      [3, '10:00', 'fitting'],
      [4, '13:15', 'consult'],
    ]
    for (const [d, time, code] of plan) {
      const svc = services.find((x) => x.code === code)!
      const startsAt = zonedToUtc(addDays(today, d), time)
      await db.insert(s.appointment).values({
        serviceId: svc.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + svc.durationMin * 60000),
        status: d === 0 ? 'confirmed' : 'booked',
        name: ['Elena Stoica', 'Mihai Rusu', 'Irina Matei', 'George Stan', 'Diana Ionescu', 'Vlad Munteanu', 'Maria Dumitru'][d]!,
        email: `programare${d}@example.com`,
        phone: '0700000000',
        manageToken: randomBytes(18).toString('base64url'),
      })
    }
  }

  await db.insert(s.inquiry).values([
    { kind: 'contact', name: 'Client demo', email: 'intrebare@example.com', subject: 'Rama Ada în altă culoare?', message: 'Bună ziua, modelul Ada 53 va fi disponibil și în verde?' },
  ])

  console.log(`✓ demo data — staff logins (password: ${pw}):`)
  for (const u of staff) console.log(`   ${u.role.padEnd(12)} ${u.email}`)
}

console.log(`✓ seed finished in ${Date.now() - t0} ms`)
await client.end()
