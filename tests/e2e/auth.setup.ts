import { test as setup } from '@playwright/test'
import { ADMIN_STATE, signIn } from './fixtures'

/** Sign in once per run; admin specs reuse the session (sign-in is rate limited). */
setup('admin session', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'sv_consent', value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, marketing: false, at: 'e2e' })), url: baseURL! }])
  await signIn(page)
  await context.storageState({ path: ADMIN_STATE })
})
