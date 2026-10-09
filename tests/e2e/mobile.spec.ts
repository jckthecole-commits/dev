import { expect, open, test } from './fixtures'

test('mobile: menu, catalog and product are usable at phone width', async ({ page }) => {
  await open(page, '/')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  await open(page, '/rame-de-vedere')
  await expect(page.getByRole('button', { name: /Filtre/ })).toBeVisible()
  // the favourite button sits above the card's stretched link
  const card = page.locator('main article').first()
  await card.getByRole('button', { name: /favorite/i }).click()
  await expect(page).toHaveURL(/\/rame-de-vedere/)
  await card.locator('h3 a').click()
  await expect(page).toHaveURL(/\/rame\//)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})
