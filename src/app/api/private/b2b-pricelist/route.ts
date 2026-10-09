import { getCatalog } from '@/server/catalog'
import { getMyPartner, getWholesalePrices } from '@/server/b2b'
import { partnerPrice } from '@/lib/pricing'

export async function GET() {
  const me = await getMyPartner()
  if (!me) return new Response('Unauthorized', { status: 401 })
  const [catalog, wholesale] = await Promise.all([getCatalog('all'), getWholesalePrices()])
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const lines = [['Cod', 'Model', 'Culoare', 'Categorie', 'Dimensiuni', 'Material', 'PVP (lei, cu TVA)', 'Pret net partener (lei, fara TVA)'].map(esc).join(';')]
  for (const p of catalog)
    for (const v of p.variants)
      lines.push([v.sku, p.name, v.colorName, p.category === 'sun' ? 'soare' : 'vedere', `${p.lensWidth}-${p.bridgeWidth}-${p.templeLength}`, p.material, (p.price / 100).toFixed(2), (partnerPrice(wholesale.get(p.id) ?? Math.round(p.price / 2.4), me.partner.discountPercent) / 100).toFixed(2)].map(esc).join(';'))
  return new Response('﻿' + lines.join('\r\n'), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="sifra-lista-preturi-${new Date().toISOString().slice(0, 10)}.csv"`, 'cache-control': 'private, no-store' },
  })
}
