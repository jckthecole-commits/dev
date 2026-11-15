import 'server-only'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { account, session, user, verification } from '@/lib/db/schema'

const appUrl = process.env.APP_URL ?? 'http://localhost:3000'

/**
 * Accounts are created by an administrator (Echipă / Modele) or with `pnpm admin:create`.
 * There is no public sign-up.
 */
export const auth = betterAuth({
  appName: 'Studio ERP',
  baseURL: appUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [appUrl],
  database: drizzleAdapter(db, { provider: 'pg', schema: { user, session, account, verification } }),
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 10, maxPasswordLength: 128 },
  user: {
    additionalFields: {
      role: { type: 'string', required: false, defaultValue: 'model', input: false },
      active: { type: 'boolean', required: false, defaultValue: true, input: false },
      phone: { type: 'string', required: false, input: false },
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  rateLimit: { enabled: true, storage: 'memory', window: 60, max: 60, customRules: { '/sign-in/email': { window: 60, max: 8 } } },
  databaseHooks: {
    session: {
      create: {
        // deactivated people can't sign in, even with the right password
        before: async (s) => {
          const u = await db.query.user.findFirst({ where: (t, { eq }) => eq(t.id, s.userId), columns: { active: true } })
          if (!u?.active) return false
        },
      },
    },
  },
  advanced: { cookiePrefix: 'studio', database: { generateId: () => randomUUID() } },
  plugins: [nextCookies()],
})
