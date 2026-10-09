import { expect, open, test, uniqueEmail } from './fixtures'

test('book a showroom appointment and cancel it from the link', async ({ page }) => {
  await open(page, '/programare')
  // independent of the time of day: pick a later day that still has free hours
  const days = page.getByRole('group', { name: 'Ziua' }).getByRole('button', { disabled: false })
  await expect(days.first()).toBeVisible()
  await days.nth(2).click()
  const slots = page.getByRole('radiogroup', { name: 'Ora' }).getByRole('radio')
  await slots.first().click()
  await page.locator('#b-name').fill('Maria Test')
  await page.locator('#b-phone').fill('0740 111 222')
  await page.locator('#b-email').fill(uniqueEmail('maria'))
  await page.locator('input[name=consent]').check()
  await page.getByRole('button', { name: 'Confirmă programarea' }).click()
  await expect(page.getByText('Ești programat.')).toBeVisible()
  await page.getByRole('link', { name: 'Vezi programarea' }).click()
  await page.getByRole('button', { name: 'Anulează programarea' }).click()
  await expect(page.getByText('Programare anulată')).toBeVisible()
})
