import { expect, test } from '@playwright/test'

test('sitemap lists products with images', async ({ request }) => {
  const res = await request.get('/sitemap.xml')
  expect(res.ok()).toBe(true)
  const xml = await res.text()
  expect(xml).toContain('/rame/mira-52</loc>')
  expect(xml).toContain('<image:loc>')
})

test('Merchant feed has one item per colour with price and availability', async ({ request }) => {
  const xml = await (await request.get('/feeds/google-merchant.xml')).text()
  expect(xml).toContain('<g:item_group_id>SV-MIRA-52</g:item_group_id>')
  expect(xml).toMatch(/<g:price>\d+\.\d{2} RON<\/g:price>/)
  expect(xml).toMatch(/<g:availability>(in_stock|out_of_stock)<\/g:availability>/)
})

test('generated images render', async ({ request }) => {
  for (const url of ['/opengraph-image', '/imagini/rame/mira-52/negru-lucios.png', '/icons/512', '/apple-icon']) {
    const res = await request.get(url)
    expect(res.status(), url).toBe(200)
    expect(res.headers()['content-type']).toBe('image/png')
  }
})

test('private areas are not indexable and send no-store', async ({ request }) => {
  const res = await request.get('/cos')
  expect(await res.text()).toContain('noindex')
  const admin = await request.get('/admin', { maxRedirects: 0 })
  expect(admin.headers()['cache-control']).toContain('no-store')
})

test('security headers are present', async ({ request }) => {
  const h = (await request.get('/')).headers()
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'")
  expect(h['x-content-type-options']).toBe('nosniff')
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
})
