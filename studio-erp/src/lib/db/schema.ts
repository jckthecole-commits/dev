/**
 * Studio ERP — database schema (PostgreSQL, Drizzle ORM).
 *
 * Conventions
 *  - Column names are snake_case in the database (drizzle `casing: 'snake_case'`).
 *  - Money is integer minor units: earnings and pay in US cents, RON amounts in bani.
 *  - Percentages are basis points (5000 = 50%). Exchange rates are RON per USD × 10 000.
 *  - Calendar days are `date` columns (studio local day); instants are timestamptz.
 */
import { sql } from 'drizzle-orm'
import { boolean, date, index, integer, jsonb, pgEnum, pgTable, text, time, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

/* ── Auth (Better Auth) ─────────────────────────────────────────────── */

export const user = pgTable(
  'user',
  {
    id: text().primaryKey(),
    name: text().notNull(),
    email: text().notNull().unique(),
    emailVerified: boolean().notNull().default(false),
    image: text(),
    /** admin | manager | trainer | model — see src/lib/roles.ts */
    role: text().notNull().default('model'),
    active: boolean().notNull().default(true),
    phone: text(),
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

/* ── Studio setup ───────────────────────────────────────────────────── */

export const room = pgTable('room', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
  active: boolean().notNull().default(true),
  sort: integer().notNull().default(0),
  ...timestamps,
})

export const shift = pgTable('shift', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
  startTime: time().notNull(),
  endTime: time().notNull(),
  active: boolean().notNull().default(true),
  sort: integer().notNull().default(0),
  ...timestamps,
})

export const platform = pgTable('platform', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
  active: boolean().notNull().default(true),
  sort: integer().notNull().default(0),
  ...timestamps,
})

export type PayoutTier = { fromCents: number; percentBp: number }
export const payoutModeEnum = pgEnum('payout_mode', ['whole', 'progressive'])

/**
 * How a model's share of the month's gross is computed.
 *  - whole: the highest tier reached sets the percentage for the whole amount.
 *  - progressive: each tier's percentage applies only to the part of the gross inside it.
 */
export const payoutPlan = pgTable('payout_plan', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
  mode: payoutModeEnum().notNull().default('whole'),
  tiers: jsonb().$type<PayoutTier[]>().notNull(),
  isDefault: boolean().notNull().default(false),
  ...timestamps,
})

export const setting = pgTable('setting', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

/* ── People ─────────────────────────────────────────────────────────── */

export const modelStatusEnum = pgEnum('model_status', ['onboarding', 'active', 'paused', 'left'])

export const model = pgTable(
  'model',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** login for the model's own portal (optional) */
    userId: text()
      .unique()
      .references(() => user.id, { onDelete: 'set null' }),
    stageName: text().notNull(),
    legalName: text().notNull(),
    email: text(),
    phone: text(),
    status: modelStatusEnum().notNull().default('onboarding'),
    startDate: date(),
    trainerId: text().references(() => user.id, { onDelete: 'set null' }),
    payoutPlanId: uuid().references(() => payoutPlan.id, { onDelete: 'set null' }),
    iban: text(),
    notes: text(),
    ...timestamps,
  },
  (t) => [uniqueIndex('model_stage_name_uq').on(sql`lower(${t.stageName})`), index('model_trainer_idx').on(t.trainerId)],
)

/** The model's username on a platform — how imported reports are matched to a model. */
export const modelAlias = pgTable(
  'model_alias',
  {
    id: uuid().primaryKey().defaultRandom(),
    modelId: uuid()
      .notNull()
      .references(() => model.id, { onDelete: 'cascade' }),
    platformId: uuid()
      .notNull()
      .references(() => platform.id, { onDelete: 'cascade' }),
    username: text().notNull(),
  },
  (t) => [uniqueIndex('model_alias_uq').on(t.platformId, sql`lower(${t.username})`)],
)

/* ── Schedule ───────────────────────────────────────────────────────── */

export const scheduleEntry = pgTable(
  'schedule_entry',
  {
    id: uuid().primaryKey().defaultRandom(),
    day: date().notNull(),
    roomId: uuid()
      .notNull()
      .references(() => room.id, { onDelete: 'cascade' }),
    shiftId: uuid()
      .notNull()
      .references(() => shift.id, { onDelete: 'cascade' }),
    modelId: uuid()
      .notNull()
      .references(() => model.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    // one model per room and shift, and a model can't be in two rooms in the same shift
    uniqueIndex('schedule_slot_uq').on(t.day, t.roomId, t.shiftId),
    uniqueIndex('schedule_model_uq').on(t.day, t.shiftId, t.modelId),
  ],
)

/* ── Money ──────────────────────────────────────────────────────────── */

export const earning = pgTable(
  'earning',
  {
    id: uuid().primaryKey().defaultRandom(),
    modelId: uuid()
      .notNull()
      .references(() => model.id, { onDelete: 'restrict' }),
    platformId: uuid()
      .notNull()
      .references(() => platform.id, { onDelete: 'restrict' }),
    day: date().notNull(),
    /** gross the studio earned on that platform that day, in US cents */
    amountCents: integer().notNull(),
    /** minutes online, if the report has it */
    minutes: integer(),
    source: text().notNull().default('manual'),
    createdBy: text().references(() => user.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [uniqueIndex('earning_uq').on(t.modelId, t.platformId, t.day), index('earning_day_idx').on(t.day)],
)

export const adjustmentKindEnum = pgEnum('adjustment_kind', ['bonus', 'advance', 'deduction'])

/** Bonuses add to the month's pay; advances and deductions subtract. Amount is always positive. */
export const adjustment = pgTable(
  'adjustment',
  {
    id: uuid().primaryKey().defaultRandom(),
    modelId: uuid()
      .notNull()
      .references(() => model.id, { onDelete: 'cascade' }),
    month: text().notNull(),
    kind: adjustmentKindEnum().notNull(),
    amountCents: integer().notNull(),
    note: text(),
    createdBy: text().references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('adjustment_month_idx').on(t.month, t.modelId)],
)

/** A closed payroll month: its earnings and adjustments are locked, the payslips below are final. */
export const payrollMonth = pgTable('payroll_month', {
  month: text().primaryKey(),
  usdToRonE4: integer().notNull(),
  closedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  closedBy: text().references(() => user.id, { onDelete: 'set null' }),
})

export const payslip = pgTable(
  'payslip',
  {
    id: uuid().primaryKey().defaultRandom(),
    month: text()
      .notNull()
      .references(() => payrollMonth.month, { onDelete: 'cascade' }),
    modelId: uuid()
      .notNull()
      .references(() => model.id, { onDelete: 'restrict' }),
    planName: text().notNull(),
    grossCents: integer().notNull(),
    percentBp: integer().notNull(),
    shareCents: integer().notNull(),
    bonusCents: integer().notNull(),
    advanceCents: integer().notNull(),
    deductionCents: integer().notNull(),
    netCents: integer().notNull(),
    netBani: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('payslip_uq').on(t.month, t.modelId)],
)

/* ── Audit ──────────────────────────────────────────────────────────── */

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
