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

  test('documents: public ones reach the compliance page, B2B ones stay private', async ({ page, request }) => {
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
    const upload = async (title: string, audience: string) => {
      await open(page, '/admin/continut?tip=documente')
      await page.locator('input[name=title]').fill(title)
      await page.locator('select[name=audience]').selectOption(audience)
      await page.locator('input[name=file]').setInputFiles({ name: 'declaratie.pdf', mimeType: 'application/pdf', buffer: pdf })
      await page.getByRole('button', { name: 'Încarcă' }).click()
      await expect(page.getByRole('link', { name: title })).toBeVisible()
      return page.getByRole('link', { name: title }).getAttribute('href')
    }
    const stamp = Date.now().toString(36)
    const pub = await upload(`Declarație test ${stamp}`, 'public')
    const b2b = await upload(`Listă prețuri test ${stamp}`, 'b2b')
    expect((await request.get(pub!)).headers()['content-type']).toBe('application/pdf')
    await open(page, '/conformitate')
    await expect(page.getByRole('link', { name: new RegExp(`Declarație test ${stamp}`) })).toBeVisible()
    const res = await page.context().browser()!.newContext().then(async (c) => { const r = await c.request.get(new URL(b2b!, page.url()).toString()); await c.close(); return r.status() })
    expect(res).toBe(401)
  })

  test('customers cannot open the admin', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL })
    const p = await ctx.newPage()
    await p.goto('/admin')
    await expect(p).toHaveURL(/\/cont\/autentificare/)
    await ctx.close()
  })
})
