import 'server-only'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { account, session, user, verification } from '@/lib/db/schema'
import { sendMail } from '@/server/mail'
import { emailLayout, emailButton } from '@/server/mail-templates'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export const auth = betterAuth({
  appName: 'Sifra Vision',
  baseURL: siteUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [siteUrl],
  database: drizzleAdapter(db, { provider: 'pg', schema: { user, session, account, verification } }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: true,
    sendResetPassword: async ({ user: u, url }) => {
      await sendMail({
        to: u.email,
        subject: 'Resetează parola contului Sifra Vision',
        html: emailLayout({
          preheader: 'Link valabil o oră.',
          title: 'Resetare parolă',
          body: `<p>Ai cerut resetarea parolei pentru contul ${u.email}. Linkul de mai jos este valabil o oră.</p>${emailButton(url, 'Alege o parolă nouă')}<p style="color:#4A545B">Dacă nu ai cerut tu, ignoră acest e-mail — parola rămâne neschimbată.</p>`,
        }),
      })
    },
  },
  socialProviders:
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
      : {},
  user: {
    additionalFields: {
      role: { type: 'string', required: false, defaultValue: 'customer', input: false },
      phone: { type: 'string', required: false },
      marketingConsent: { type: 'boolean', required: false, defaultValue: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    customRules: { '/sign-in/email': { window: 60, max: 8 }, '/forget-password': { window: 300, max: 3 } },
  },
  advanced: {
    cookiePrefix: 'sv',
    database: { generateId: () => randomUUID() },
  },
  plugins: [nextCookies()],
})

export type AuthSession = typeof auth.$Infer.Session
