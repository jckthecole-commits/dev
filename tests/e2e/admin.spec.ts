import { expect, open, signIn, test } from './fixtures'

test.describe('admin', () => {
  test.beforeEach(async ({ page }) => signIn(page))

  test('dashboard shows KPIs and the go-live checklist', async ({ page }) => {
    await expect(page.getByText('Venituri · 30 zile')).toBeVisible()
    await expect(page.getByText(/Pregătire lansare · \d+\/\d+/)).toBeVisible()
  })

  test('an unverified prescription blocks the lab', async ({ page }) => {
    await open(page, '/admin/comenzi?status=rx_review')
    await page.locator('table a[href^="/admin/comenzi/"]').first().click()
    await page.getByRole('button', { name: /În laborator/ }).click()
    await expect(page.getByText('Rețeta trebuie verificată de optometrist înainte de laborator.')).toBeVisible()
  })

  test('lab work order prints the prescription grid', async ({ page }) => {
    await open(page, '/admin/comenzi?status=rx_review')
    const href = await page.locator('table a[href^="/admin/comenzi/"]').first().getAttribute('href')
    await open(page, `${href}/fisa`)
    await expect(page.getByText('Fișă de montaj', { exact: false }).first()).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'SPH' }).first()).toBeVisible()
  })

  test('product editor validates real-world dimensions', async ({ page }) => {
    await open(page, '/admin/produse/nou')
    await page.getByPlaceholder('ex. Mira').fill('Validare')
    await page.getByLabel('A · lentilă').fill('90')
    await page.getByLabel('Preț (cu TVA)').fill('300')
    await page.getByRole('button', { name: 'Creează produsul' }).click()
    await expect(page.getByText('A între 38 și 66 mm').first()).toBeVisible()
  })

  test('customers cannot open the admin', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL })
    const p = await ctx.newPage()
    await p.goto('/admin')
    await expect(p).toHaveURL(/\/cont\/autentificare/)
    await ctx.close()
  })
})
