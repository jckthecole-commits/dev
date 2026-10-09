/**
 * Sifra Vision — database schema (PostgreSQL, Drizzle ORM).
 *
 * Conventions
 *  - Column names are snake_case in the database (drizzle `casing: 'snake_case'`).
 *  - Money is stored as integer minor units (bani: 1 RON = 100 bani).
 *  - Lengths are millimetres. Times are timestamptz (UTC); display in Europe/Bucharest.
 *  - Health data (prescriptions) is encrypted at the application layer — see lib/crypto.ts.
 */
import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  pgSequence,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

/* ════════════════════════════════════════════════════════════════════════
   AUTH (Better Auth) — user / session / account / verification
   ════════════════════════════════════════════════════════════════════════ */

export const user = pgTable(
  'user',
  {
    id: text().primaryKey(),
    name: text().notNull(),
    email: text().notNull().unique(),
    emailVerified: boolean().notNull().default(false),
    image: text(),
    role: text().default('customer'),
    banned: boolean().default(false),
    banReason: text(),
    banExpires: timestamp({ withTimezone: true }),
    phone: text(),
    marketingConsent: boolean().notNull().default(false),
    ...timestamps,
  },
  (t) => [index('user_role_idx').on(t.role)],
)

export const session = pgTable(
  'session',
  {
    id: text().primaryKey(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    ipAddress: text(),
    userAgent: text(),
    impersonatedBy: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [index('session_user_idx').on(t.userId)],
)

export const account = pgTable(
  'account',
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    ...timestamps,
  },
  (t) => [index('account_user_idx').on(t.userId)],
)

export const verification = pgTable(
  'verification',
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
)

export const address = pgTable(
  'address',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    label: text(),
    name: text().notNull(),
    phone: text().notNull(),
    street: text().notNull(),
    city: text().notNull(),
    county: text().notNull(),
    postalCode: text(),
    country: text().notNull().default('RO'),
    isDefault: boolean().notNull().default(false),
    ...timestamps,
  },
  (t) => [index('address_user_idx').on(t.userId)],
)

/* ════════════════════════════════════════════════════════════════════════
   CATALOG
   ════════════════════════════════════════════════════════════════════════ */

export const productCategory = pgEnum('product_category', ['optical', 'sun'])
export const productStatus = pgEnum('product_status', ['draft', 'active', 'archived'])
export const frameShape = pgEnum('frame_shape', [
  'rectangular',
  'square',
  'round',
  'oval',
  'cat-eye',
  'pilot',
  'browline',
  'geometric',
])
export const frameMaterial = pgEnum('frame_material', ['acetat', 'metal', 'titan', 'tr90', 'combinat'])
export const frameRim = pgEnum('frame_rim', ['full', 'semi', 'rimless'])
export const audience = pgEnum('audience', ['unisex', 'women', 'men', 'kids'])
export const vatClass = pgEnum('vat_class', ['standard', 'reduced', 'exempt'])

/** Geometry used by the procedural frame renderer (FrameArt) and the virtual try-on. */
export type FrameGeometry = {
  /** Visual rim thickness in mm (acetate ≈ 4–6, metal ≈ 1–1.6). */
  rim: number
  /** Bridge style: keyhole (acetate), saddle, double (aviator bar). */
  bridgeStyle: 'keyhole' | 'saddle' | 'double' | 'straight'
  /** Shape tension 2 (ellipse) … 6 (squarer). Optional override. */
  tension?: number
  /** Cat-eye lift 0…1, aviator droop 0…1. */
  lift?: number
  /** Browline: top rim thickness multiplier. */
  browWeight?: number
  /** Nose pads (metal frames). */
  pads?: boolean
}

export type Swatch = {
  kind: 'solid' | 'havana' | 'crystal' | 'metal' | 'gradient'
  /** Main colour */
  primary: string
  /** Secondary colour: tortoise spots, metal shade, gradient end */
  secondary?: string
  /** Temple colour if different */
  temple?: string
  /** Lens tint (sunglasses) */
  lens?: string
  /** Lens tint gradient */
  lensGradient?: boolean
  /** Mirror coating (sunglasses) */
  mirror?: string
}

export const product = pgTable(
  'product',
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull().unique(),
    name: text().notNull(),
    /** Collection line, e.g. "Mira". Shared by sizes. */
    family: text().notNull(),
    modelCode: text().notNull().unique(),
    category: productCategory().notNull().default('optical'),
    status: productStatus().notNull().default('draft'),
    audience: audience().notNull().default('unisex'),
    shape: frameShape().notNull(),
    material: frameMaterial().notNull(),
    rim: frameRim().notNull().default('full'),
    /** 52□18 145 */
    lensWidth: smallint().notNull(),
    bridgeWidth: smallint().notNull(),
    templeLength: smallint().notNull(),
    lensHeight: smallint().notNull(),
    frameWidth: smallint().notNull(),
    weightGrams: real(),
    geometry: jsonb().$type<FrameGeometry>().notNull(),
    tagline: text(),
    description: text(),
    highlights: jsonb().$type<string[]>().notNull().default([]),
    features: jsonb().$type<string[]>().notNull().default([]),
    /** Sunglasses */
    filterCategory: smallint(),
    polarized: boolean().notNull().default(false),
    /** Prices (bani) */
    price: integer().notNull(),
    compareAtPrice: integer(),
    wholesalePrice: integer(),
    vatClass: vatClass().notNull().default('standard'),
    badge: text(),
    featured: boolean().notNull().default(false),
    position: integer().notNull().default(0),
    /** Regulatory (EU MDR / PPE / GPSR) */
    manufacturer: text(),
    countryOfOrigin: text(),
    ceMarking: text(),
    /** Normalised (lowercase, no diacritics) text for search. */
    searchText: text().notNull().default(''),
    metaTitle: text(),
    metaDescription: text(),
    publishedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('product_status_cat_idx').on(t.status, t.category),
    index('product_shape_idx').on(t.shape),
    index('product_family_idx').on(t.family),
    index('product_search_idx').using('gin', sql`to_tsvector('simple', ${t.searchText})`),
  ],
)

export const variant = pgTable(
  'variant',
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid()
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    sku: text().notNull().unique(),
    ean: text(),
    colorName: text().notNull(),
    colorSlug: text().notNull(),
    /** Filter bucket: negru | havana | transparent | gri | albastru | verde | rosu | roz | maro | auriu | argintiu | bej */
    colorFamily: text().notNull().default('negru'),
    swatch: jsonb().$type<Swatch>().notNull(),
    priceDelta: integer().notNull().default(0),
    position: integer().notNull().default(0),
    isDefault: boolean().notNull().default(false),
    active: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [index('variant_product_idx').on(t.productId), uniqueIndex('variant_color_uq').on(t.productId, t.colorSlug)],
)

export const location = pgTable('location', {
  id: uuid().primaryKey().defaultRandom(),
  code: text().notNull().unique(),
  name: text().notNull(),
  kind: text().notNull().default('store'), // store | warehouse
  address: text(),
  /** Stock from this location is sellable online */
  sellable: boolean().notNull().default(true),
  ...timestamps,
})

export const inventory = pgTable(
  'inventory',
  {
    variantId: uuid()
      .notNull()
      .references(() => variant.id, { onDelete: 'cascade' }),
    locationId: uuid()
      .notNull()
      .references(() => location.id, { onDelete: 'cascade' }),
    onHand: integer().notNull().default(0),
    reserved: integer().notNull().default(0),
    reorderPoint: integer().notNull().default(2),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.variantId, t.locationId] })],
)

export const stockMovement = pgTable(
  'stock_movement',
  {
    id: uuid().primaryKey().defaultRandom(),
    variantId: uuid()
      .notNull()
      .references(() => variant.id, { onDelete: 'cascade' }),
    locationId: uuid()
      .notNull()
      .references(() => location.id, { onDelete: 'cascade' }),
    delta: integer().notNull(),
    reason: text().notNull(), // sale | return | adjustment | receipt | transfer | b2b
    reference: text(),
    actorId: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('stock_movement_variant_idx').on(t.variantId)],
)

export const productImage = pgTable(
  'product_image',
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid()
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    variantId: uuid().references(() => variant.id, { onDelete: 'set null' }),
    key: text().notNull(),
    alt: text().notNull().default(''),
    width: integer(),
    height: integer(),
    kind: text().notNull().default('packshot'), // packshot | lifestyle | detail
    position: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('product_image_product_idx').on(t.productId)],
)

/* ════════════════════════════════════════════════════════════════════════
   LENSES
   ════════════════════════════════════════════════════════════════════════ */

export const lensType = pgTable('lens_type', {
  id: uuid().primaryKey().defaultRandom(),
  code: text().notNull().unique(), // none | single | progressive | office | plano
  name: text().notNull(),
  summary: text().notNull(),
  description: text(),
  price: integer().notNull().default(0),
  requiresPrescription: boolean().notNull().default(true),
  requiresAdd: boolean().notNull().default(false),
  /** Minimum frame lens height (mm) — progressives need ≥ 28 mm. */
  minFittingHeight: smallint(),
  categories: jsonb().$type<('optical' | 'sun')[]>().notNull().default(['optical', 'sun']),
  vatClass: vatClass().notNull().default('standard'),
  active: boolean().notNull().default(true),
  position: integer().notNull().default(0),
  ...timestamps,
})

export const lensIndex = pgTable('lens_index', {
  id: uuid().primaryKey().defaultRandom(),
  code: text().notNull().unique(), // 1.50 | 1.60 | 1.67 | 1.74
  refractiveIndex: real().notNull(),
  abbe: real(),
  name: text().notNull(),
  summary: text().notNull(),
  /** Surcharge per pair (bani) */
  price: integer().notNull().default(0),
  /** Recommended for |power| ≤ value (dioptres) */
  recommendedUpTo: real(),
  lensTypes: jsonb().$type<string[]>().notNull().default(['single', 'progressive', 'office', 'plano']),
  active: boolean().notNull().default(true),
  position: integer().notNull().default(0),
  ...timestamps,
})

export const lensTreatment = pgTable('lens_treatment', {
  id: uuid().primaryKey().defaultRandom(),
  code: text().notNull().unique(), // hardcoat | ar | blue | photo | polar | tint
  name: text().notNull(),
  summary: text().notNull(),
  price: integer().notNull().default(0),
  /** Included & preselected */
  isDefault: boolean().notNull().default(false),
  /** Mutually exclusive group, e.g. "tint" for photochromic / polarised / solid tint. */
  exclusiveGroup: text(),
  categories: jsonb().$type<('optical' | 'sun')[]>().notNull().default(['optical']),
  lensTypes: jsonb().$type<string[]>().notNull().default(['single', 'progressive', 'office', 'plano']),
  active: boolean().notNull().default(true),
  position: integer().notNull().default(0),
  ...timestamps,
})

/* ════════════════════════════════════════════════════════════════════════
   PRESCRIPTIONS (health data — encrypted payload)
   ════════════════════════════════════════════════════════════════════════ */

export const rxStatus = pgEnum('rx_status', ['pending', 'verified', 'needs_info', 'rejected'])
export const rxSource = pgEnum('rx_source', ['manual', 'upload', 'later', 'exam'])

export const prescription = pgTable(
  'prescription',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text().references(() => user.id, { onDelete: 'set null' }),
    label: text(),
    source: rxSource().notNull(),
    /** AES-256-GCM encrypted JSON (RxValues). */
    dataEnc: text(),
    /** Encrypted upload (photo / PDF) storage key. */
    fileKey: text(),
    fileMime: text(),
    examDate: date(),
    status: rxStatus().notNull().default('pending'),
    verifiedById: text().references(() => user.id, { onDelete: 'set null' }),
    verifiedAt: timestamp({ withTimezone: true }),
    reviewNote: text(),
    ...timestamps,
  },
  (t) => [index('prescription_user_idx').on(t.userId), index('prescription_status_idx').on(t.status)],
)

/* ════════════════════════════════════════════════════════════════════════
   CART
   ════════════════════════════════════════════════════════════════════════ */

/** What the customer chose in the configurator. Prices are recomputed server-side. */
export type LineConfiguration = {
  lensType: string
  lensIndex?: string
  treatments: string[]
  rxMode?: 'manual' | 'upload' | 'later' | 'saved'
  prescriptionId?: string
  /** Fitting height / notes for the lab */
  notes?: string
}

export const cart = pgTable('cart', {
  id: uuid().primaryKey().defaultRandom(),
  userId: text().references(() => user.id, { onDelete: 'cascade' }),
  couponCode: text(),
  ...timestamps,
})

export const cartItem = pgTable(
  'cart_item',
  {
    id: uuid().primaryKey().defaultRandom(),
    cartId: uuid()
      .notNull()
      .references(() => cart.id, { onDelete: 'cascade' }),
    variantId: uuid()
      .notNull()
      .references(() => variant.id, { onDelete: 'cascade' }),
    quantity: integer().notNull().default(1),
    configuration: jsonb().$type<LineConfiguration>().notNull(),
    ...timestamps,
  },
  (t) => [index('cart_item_cart_idx').on(t.cartId)],
)

/* ════════════════════════════════════════════════════════════════════════
   ORDERS
   ════════════════════════════════════════════════════════════════════════ */

export const orderStatus = pgEnum('order_status', [
  'pending_payment',
  'placed',
  'rx_review',
  'on_hold',
  'in_lab',
  'qc',
  'ready',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
])
export const paymentStatus = pgEnum('payment_status', ['pending', 'authorized', 'paid', 'failed', 'refunded', 'partially_refunded'])
export const paymentMethod = pgEnum('payment_method', ['card', 'cod', 'transfer', 'store'])
export const shippingMethod = pgEnum('shipping_method', ['courier', 'easybox', 'pickup'])
export const orderChannel = pgEnum('order_channel', ['b2c', 'b2b', 'store'])

export type PostalAddress = {
  name: string
  phone: string
  street: string
  city: string
  county: string
  postalCode?: string
  country: string
  company?: string
  cui?: string
  regCom?: string
  lockerId?: string
  lockerName?: string
}

export type PriceLine = { code: string; label: string; amount: number }

/** Human-friendly order numbers: SV-2026-001001 */
export const orderNumberSeq = pgSequence('order_number_seq', { startWith: 1001, increment: 1 })

export const order = pgTable(
  'order',
  {
    id: uuid().primaryKey().defaultRandom(),
    number: text().notNull().unique(),
    /** Unguessable token for guest order tracking links. */
    accessToken: text().notNull(),
    channel: orderChannel().notNull().default('b2c'),
    userId: text().references(() => user.id, { onDelete: 'set null' }),
    partnerId: uuid().references(() => partner.id, { onDelete: 'set null' }),
    email: text().notNull(),
    phone: text().notNull(),
    customerName: text().notNull(),
    status: orderStatus().notNull().default('placed'),
    paymentStatus: paymentStatus().notNull().default('pending'),
    paymentMethod: paymentMethod().notNull(),
    paymentProvider: text(),
    paymentRef: text(),
    shippingMethod: shippingMethod().notNull(),
    shippingAddress: jsonb().$type<PostalAddress>(),
    billingAddress: jsonb().$type<PostalAddress>(),
    subtotal: integer().notNull(),
    discountTotal: integer().notNull().default(0),
    shippingTotal: integer().notNull().default(0),
    vatTotal: integer().notNull().default(0),
    total: integer().notNull(),
    currency: text().notNull().default('RON'),
    couponCode: text(),
    customerNote: text(),
    internalNote: text(),
    awb: text(),
    carrier: text(),
    trackingUrl: text(),
    invoiceSeries: text(),
    invoiceNumber: text(),
    invoiceUrl: text(),
    requiresRx: boolean().notNull().default(false),
    marketingConsent: boolean().notNull().default(false),
    placedAt: timestamp({ withTimezone: true }),
    paidAt: timestamp({ withTimezone: true }),
    shippedAt: timestamp({ withTimezone: true }),
    deliveredAt: timestamp({ withTimezone: true }),
    cancelledAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('order_status_idx').on(t.status),
    index('order_user_idx').on(t.userId),
    index('order_created_idx').on(t.createdAt),
    index('order_email_idx').on(t.email),
  ],
)

export const orderItem = pgTable(
  'order_item',
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => order.id, { onDelete: 'cascade' }),
    variantId: uuid().references(() => variant.id, { onDelete: 'set null' }),
    productId: uuid().references(() => product.id, { onDelete: 'set null' }),
    productName: text().notNull(),
    variantName: text().notNull(),
    sku: text().notNull(),
    quantity: integer().notNull(),
    unitPrice: integer().notNull(),
    lineTotal: integer().notNull(),
    vatRate: real().notNull(),
    configuration: jsonb().$type<LineConfiguration>(),
    priceBreakdown: jsonb().$type<PriceLine[]>().notNull().default([]),
    prescriptionId: uuid().references(() => prescription.id, { onDelete: 'set null' }),
    /** Where the stock for this line is reserved (released on cancel, consumed on dispatch). */
    stockLocationId: uuid().references(() => location.id, { onDelete: 'set null' }),
    /** Snapshot of frame data for the lab work order. */
    frameSnapshot: jsonb().$type<{ lensWidth: number; bridgeWidth: number; templeLength: number; lensHeight: number; shape: string }>(),
  },
  (t) => [index('order_item_order_idx').on(t.orderId)],
)

export const orderEvent = pgTable(
  'order_event',
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => order.id, { onDelete: 'cascade' }),
    kind: text().notNull(), // status | payment | note | email | shipment | rx
    fromStatus: text(),
    toStatus: text(),
    message: text(),
    /** Visible to the customer on the tracking page */
    public: boolean().notNull().default(false),
    actorId: text(),
    actorName: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('order_event_order_idx').on(t.orderId)],
)

export const coupon = pgTable('coupon', {
  id: uuid().primaryKey().defaultRandom(),
  code: text().notNull().unique(),
  description: text(),
  kind: text().notNull(), // percent | fixed | free_shipping
  value: integer().notNull().default(0), // percent (0-100) or bani
  minSubtotal: integer().notNull().default(0),
  appliesTo: text().notNull().default('all'), // all | frames | lenses
  startsAt: timestamp({ withTimezone: true }),
  endsAt: timestamp({ withTimezone: true }),
  usageLimit: integer(),
  usedCount: integer().notNull().default(0),
  active: boolean().notNull().default(true),
  ...timestamps,
})

/* ════════════════════════════════════════════════════════════════════════
   APPOINTMENTS
   ════════════════════════════════════════════════════════════════════════ */

export const appointmentStatus = pgEnum('appointment_status', ['booked', 'confirmed', 'completed', 'no_show', 'cancelled'])

export const service = pgTable('service', {
  id: uuid().primaryKey().defaultRandom(),
  code: text().notNull().unique(),
  name: text().notNull(),
  summary: text().notNull(),
  durationMin: smallint().notNull(),
  price: integer().notNull().default(0),
  /** Parallel bookings per slot (number of rooms / staff). */
  capacity: smallint().notNull().default(1),
  active: boolean().notNull().default(true),
  position: integer().notNull().default(0),
  ...timestamps,
})

export const appointment = pgTable(
  'appointment',
  {
    id: uuid().primaryKey().defaultRandom(),
    serviceId: uuid()
      .notNull()
      .references(() => service.id, { onDelete: 'restrict' }),
    userId: text().references(() => user.id, { onDelete: 'set null' }),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    status: appointmentStatus().notNull().default('booked'),
    name: text().notNull(),
    email: text().notNull(),
    phone: text().notNull(),
    note: text(),
    staffNote: text(),
    manageToken: text().notNull(),
    reminderSentAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('appointment_starts_idx').on(t.startsAt), index('appointment_status_idx').on(t.status)],
)

export const scheduleException = pgTable('schedule_exception', {
  id: uuid().primaryKey().defaultRandom(),
  day: date().notNull().unique(),
  closed: boolean().notNull().default(true),
  opens: text(),
  closes: text(),
  note: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

/* ════════════════════════════════════════════════════════════════════════
   B2B — partner opticians
   ════════════════════════════════════════════════════════════════════════ */

export const partnerStatus = pgEnum('partner_status', ['pending', 'approved', 'rejected', 'suspended'])

export const partner = pgTable(
  'partner',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text().references(() => user.id, { onDelete: 'set null' }),
    companyName: text().notNull(),
    cui: text().notNull(),
    regCom: text(),
    address: text().notNull(),
    city: text().notNull(),
    county: text().notNull(),
    contactName: text().notNull(),
    email: text().notNull(),
    phone: text().notNull(),
    storesCount: smallint(),
    website: text(),
    message: text(),
    status: partnerStatus().notNull().default('pending'),
    tier: text().notNull().default('standard'), // standard | silver | gold
    /** Extra discount (percent) applied on top of wholesale price */
    discountPercent: smallint().notNull().default(0),
    paymentTermsDays: smallint().notNull().default(0),
    creditLimit: integer(),
    internalNote: text(),
    approvedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('partner_status_idx').on(t.status), uniqueIndex('partner_cui_uq').on(t.cui)],
)

export const document = pgTable('document', {
  id: uuid().primaryKey().defaultRandom(),
  title: text().notNull(),
  kind: text().notNull(), // conformity | catalog | pricelist | certificate | other
  fileKey: text().notNull(),
  fileName: text().notNull(),
  mime: text().notNull(),
  size: integer().notNull(),
  productId: uuid().references(() => product.id, { onDelete: 'set null' }),
  audience: text().notNull().default('b2b'), // public | b2b | internal
  ...timestamps,
})

/* ════════════════════════════════════════════════════════════════════════
   CONTENT
   ════════════════════════════════════════════════════════════════════════ */

export const postStatus = pgEnum('post_status', ['draft', 'published'])

export const post = pgTable(
  'post',
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull().unique(),
    kind: text().notNull().default('article'), // article | page
    title: text().notNull(),
    excerpt: text(),
    body: text().notNull(),
    category: text(),
    coverKey: text(),
    authorName: text(),
    readingMinutes: smallint(),
    status: postStatus().notNull().default('draft'),
    metaTitle: text(),
    metaDescription: text(),
    publishedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('post_kind_status_idx').on(t.kind, t.status)],
)

export const faq = pgTable('faq', {
  id: uuid().primaryKey().defaultRandom(),
  question: text().notNull(),
  answer: text().notNull(),
  topic: text().notNull().default('general'),
  position: integer().notNull().default(0),
  active: boolean().notNull().default(true),
  ...timestamps,
})

export const reviewStatus = pgEnum('review_status', ['pending', 'approved', 'rejected'])

export const review = pgTable(
  'review',
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid()
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    userId: text().references(() => user.id, { onDelete: 'set null' }),
    name: text().notNull(),
    city: text(),
    rating: smallint().notNull(),
    title: text(),
    body: text().notNull(),
    fit: text(), // narrow | true | wide
    verifiedPurchase: boolean().notNull().default(false),
    status: reviewStatus().notNull().default('pending'),
    reply: text(),
    ...timestamps,
  },
  (t) => [index('review_product_idx').on(t.productId, t.status)],
)

/* ════════════════════════════════════════════════════════════════════════
   CRM — leads, newsletter, contact
   ════════════════════════════════════════════════════════════════════════ */

export const inquiry = pgTable(
  'inquiry',
  {
    id: uuid().primaryKey().defaultRandom(),
    kind: text().notNull(), // contact | callback | return
    name: text().notNull(),
    email: text(),
    phone: text(),
    subject: text(),
    message: text().notNull(),
    status: text().notNull().default('new'), // new | open | closed
    orderNumber: text(),
    ...timestamps,
  },
  (t) => [index('inquiry_status_idx').on(t.status)],
)

export const subscriber = pgTable('subscriber', {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  source: text(),
  confirmToken: text(),
  confirmedAt: timestamp({ withTimezone: true }),
  unsubscribedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

/* ════════════════════════════════════════════════════════════════════════
   PLATFORM — settings, audit, rate limit
   ════════════════════════════════════════════════════════════════════════ */

export const setting = pgTable('setting', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  updatedBy: text(),
})

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid().primaryKey().defaultRandom(),
    actorId: text(),
    actorEmail: text(),
    action: text().notNull(),
    entity: text().notNull(),
    entityId: text(),
    data: jsonb(),
    ip: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_entity_idx').on(t.entity, t.entityId), index('audit_created_idx').on(t.createdAt)],
)

export const rateLimit = pgTable('rate_limit', {
  key: text().primaryKey(),
  count: integer().notNull(),
  resetAt: timestamp({ withTimezone: true }).notNull(),
})

/* ════════════════════════════════════════════════════════════════════════
   RELATIONS
   ════════════════════════════════════════════════════════════════════════ */

export const productRelations = relations(product, ({ many }) => ({
  variants: many(variant),
  images: many(productImage),
  reviews: many(review),
}))

export const variantRelations = relations(variant, ({ one, many }) => ({
  product: one(product, { fields: [variant.productId], references: [product.id] }),
  inventory: many(inventory),
  images: many(productImage),
}))

export const inventoryRelations = relations(inventory, ({ one }) => ({
  variant: one(variant, { fields: [inventory.variantId], references: [variant.id] }),
  location: one(location, { fields: [inventory.locationId], references: [location.id] }),
}))

export const productImageRelations = relations(productImage, ({ one }) => ({
  product: one(product, { fields: [productImage.productId], references: [product.id] }),
  variant: one(variant, { fields: [productImage.variantId], references: [variant.id] }),
}))

export const cartRelations = relations(cart, ({ many }) => ({ items: many(cartItem) }))
export const cartItemRelations = relations(cartItem, ({ one }) => ({
  cart: one(cart, { fields: [cartItem.cartId], references: [cart.id] }),
  variant: one(variant, { fields: [cartItem.variantId], references: [variant.id] }),
}))

export const orderRelations = relations(order, ({ many, one }) => ({
  items: many(orderItem),
  events: many(orderEvent),
  user: one(user, { fields: [order.userId], references: [user.id] }),
  partner: one(partner, { fields: [order.partnerId], references: [partner.id] }),
}))
export const orderItemRelations = relations(orderItem, ({ one }) => ({
  order: one(order, { fields: [orderItem.orderId], references: [order.id] }),
  variant: one(variant, { fields: [orderItem.variantId], references: [variant.id] }),
  product: one(product, { fields: [orderItem.productId], references: [product.id] }),
  prescription: one(prescription, { fields: [orderItem.prescriptionId], references: [prescription.id] }),
}))
export const orderEventRelations = relations(orderEvent, ({ one }) => ({
  order: one(order, { fields: [orderEvent.orderId], references: [order.id] }),
}))

export const appointmentRelations = relations(appointment, ({ one }) => ({
  service: one(service, { fields: [appointment.serviceId], references: [service.id] }),
}))

export const reviewRelations = relations(review, ({ one }) => ({
  product: one(product, { fields: [review.productId], references: [product.id] }),
}))

export const partnerRelations = relations(partner, ({ one, many }) => ({
  user: one(user, { fields: [partner.userId], references: [user.id] }),
  orders: many(order),
}))

export const prescriptionRelations = relations(prescription, ({ one }) => ({
  user: one(user, { fields: [prescription.userId], references: [user.id] }),
}))

export type Product = typeof product.$inferSelect
export type Variant = typeof variant.$inferSelect
export type Order = typeof order.$inferSelect
export type OrderItem = typeof orderItem.$inferSelect
export type LensType = typeof lensType.$inferSelect
export type LensIndex = typeof lensIndex.$inferSelect
export type LensTreatment = typeof lensTreatment.$inferSelect
export type Appointment = typeof appointment.$inferSelect
export type Service = typeof service.$inferSelect
export type Partner = typeof partner.$inferSelect
export type Post = typeof post.$inferSelect
export type Review = typeof review.$inferSelect
export type Prescription = typeof prescription.$inferSelect
export type Coupon = typeof coupon.$inferSelect
