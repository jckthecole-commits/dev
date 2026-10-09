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
      // Accounts created by staff (partner approval, team invite) have no password yet → invitation copy.
      const hasPassword = await db.query.account.findFirst({ where: (a, { and, eq }) => and(eq(a.userId, u.id), eq(a.providerId, 'credential')), columns: { id: true } })
      if (!hasPassword) {
        await sendMail({
          to: u.email,
          subject: 'Contul tău Sifra Vision este gata — alege o parolă',
          html: emailLayout({
            preheader: 'Setează parola ca să intri în cont.',
            title: `Bun venit, ${u.name.split(' ')[0]}!`,
            body: `<p>Ți-am creat un cont pe sifravision.ro pentru ${u.email}. Alege o parolă ca să intri — linkul e valabil o oră; după aceea folosește „Am uitat parola” cu aceeași adresă.</p>${emailButton(url, 'Setează parola')}`,
          }),
        })
        return
      }
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
    // single trusted value resolved in src/proxy.ts from the proxy hop (not spoofable)
    ipAddress: { ipAddressHeaders: ['x-client-ip'] },
    cookiePrefix: 'sv',
    database: { generateId: () => randomUUID() },
  },
  plugins: [nextCookies()],
})

export type AuthSession = typeof auth.$Infer.Session
