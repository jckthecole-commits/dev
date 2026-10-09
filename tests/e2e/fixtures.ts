import { test as base, expect, type Page } from '@playwright/test'

/** Every test starts with a stored cookie choice so the consent banner stays out of the way. */
export const test = base.extend({
  context: async ({ context, baseURL }, provide) => {
    await context.addCookies([{ name: 'sv_consent', value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, marketing: false, at: 'e2e' })), url: baseURL! }])
    await provide(context)
  },
  page: async ({ page }, provide) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await provide(page)
    expect(errors, 'uncaught page errors').toEqual([])
  },
})
export { expect }

/**
 * Navigate and wait until streaming has settled: with Partial Prerendering the
 * static shell (fallbacks) and the streamed segment briefly coexist in the DOM.
 */
export async function open(page: Page, url: string) {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
}

export const ADMIN = { email: 'admin@sifravision.ro', password: process.env.DEMO_PASSWORD ?? 'sifra-demo-2026' }

export async function signIn(page: Page, who = ADMIN, next = '/admin') {
  await open(page, `/cont/autentificare?next=${encodeURIComponent(next)}`)
  await page.locator('#auth-email').fill(who.email)
  await page.locator('#auth-password').fill(who.password)
  await page.getByRole('button', { name: 'Intră în cont' }).last().click()
  await page.waitForURL((u) => u.pathname === next, { timeout: 30_000 })
}

/** A unique e-mail per run, so reruns don't collide. */
export const uniqueEmail = (prefix: string) => `${prefix}.${Date.now().toString(36)}@example.com`
