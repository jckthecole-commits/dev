import { formatPrice } from '@/lib/format'
import { abs } from '@/lib/seo'
import { WEEKDAYS_RO } from '@/lib/settings-schema'
import { getCatalog, getLensCatalog } from '@/server/catalog'
import { getPublishedPosts } from '@/server/content'
import { getSettings } from '@/server/settings'

/** llms.txt — a concise, factual map of the shop for AI assistants and answer engines. */
export async function GET() {
  const [s, products, lenses, posts] = await Promise.all([getSettings(), getCatalog('all'), getLensCatalog(), getPublishedPosts('article')])
  const optical = products.filter((p) => p.category === 'optical')
  const sun = products.filter((p) => p.category === 'sun')
  const minPrice = (list: typeof products) => (list.length ? formatPrice(Math.min(...list.map((p) => p.price))) : '—')
  const hours = [1, 2, 3, 4, 5, 6, 0]
    .map((d) => {
      const h = s.hours.weekly.find((x) => x.day === d)
      return `${WEEKDAYS_RO[d]}: ${!h || 'closed' in h ? 'închis' : `${h.open}–${h.close}`}`
    })
    .join(', ')
  const body = `# ${s.company.brand}

> Optică online și showroom în ${s.company.city}, România. Rame de vedere și ochelari de soare marca SIFRA, cu lentile montate pe dioptria clientului. Prețul complet (ramă + lentile + tratamente) se calculează în configurator înainte de plată; fiecare rețetă este verificată de un optometrist înainte de laborator.

Informații esențiale:
- Showroom: ${s.company.address}, ${s.company.city}, jud. ${s.company.county}. Program: ${hours}.
- Contact: ${[s.company.phone, s.company.email].filter(Boolean).join(' · ')}
- Livrare în România: curier ${formatPrice(s.shipping.courier.price)}, easybox ${formatPrice(s.shipping.easybox.price)}, gratuit de la ${formatPrice(s.shipping.freeThreshold)}; ridicare gratuită din showroom.
- Execuție lentile: ${s.policies.productionDaysMin}–${s.policies.productionDaysMax} zile lucrătoare. Retur ${s.policies.returnDays} zile, garanție ${s.policies.warrantyMonths} luni, garanție de adaptare ${s.policies.adaptationDays} zile.
- Plată: card online${s.payments.cod.enabled ? ', ramburs' : ''}${s.payments.transfer.enabled ? ', transfer bancar' : ''}${s.payments.store.enabled ? ', la ridicare' : ''}.
- Catalog: ${optical.length} rame de vedere (de la ${minPrice(optical)}), ${sun.length} modele de ochelari de soare (de la ${minPrice(sun)}). Fiecare model are dimensiunile reale (lățime lentilă, punte, braț, înălțime lentilă) și probă virtuală la scară reală din browser.
- Pentru optici: program B2B cu prețuri en-gros, portal de comandă pe SKU și termene de plată.

## Lentile (preț per pereche, adăugat la ramă)
${lenses.types.filter((t) => t.active && t.code !== 'none').map((t) => `- ${t.name}: ${t.price ? formatPrice(t.price) : 'inclus'} — ${t.summary}`).join('\n')}
${lenses.indices.filter((i) => i.active).map((i) => `- Indice ${i.code} (${i.name}): ${i.price ? `+${formatPrice(i.price)}` : 'inclus'} — ${i.summary}`).join('\n')}
${lenses.treatments.filter((t) => t.active).map((t) => `- ${t.name}: ${t.isDefault ? 'inclus' : `+${formatPrice(t.price)}`} — ${t.summary}`).join('\n')}

## Pagini principale
- [Rame de vedere](${abs('/rame-de-vedere')}): catalog cu filtre după formă, material și dimensiuni
- [Ochelari de soare](${abs('/ochelari-de-soare')}): categoria filtrului, polarizare, UV400
- [Lentile](${abs('/lentile')}): tipuri, indici, tratamente și cum alegi
- [Probă virtuală](${abs('/proba-virtuala')}): ramele pe fața ta la scară reală + măsurarea distanței pupilare
- [Programare](${abs('/programare')}): consultație optometrică și probă de rame în showroom
- [Showroom Galați](${abs('/showroom-galati')})
- [Conformitate și siguranță](${abs('/conformitate')}): dispozitive medicale (MDR 2017/745), EN ISO 12312-1, garanție, retur
- [Întrebări frecvente](${abs('/intrebari-frecvente')})
- [Parteneri B2B](${abs('/b2b')})

## Modele
${products.map((p) => `- [${p.name}](${abs(`/rame/${p.slug}`)}): ${p.category === 'sun' ? 'ochelari de soare' : 'ramă de vedere'}, ${p.lensWidth}-${p.bridgeWidth}-${p.templeLength} mm, ${p.variants.length} ${p.variants.length === 1 ? 'culoare' : 'culori'}, ${formatPrice(p.price)}`).join('\n')}

## Ghiduri
${posts.map((a) => `- [${a.title}](${abs(`/jurnal/${a.slug}`)})${a.excerpt ? `: ${a.excerpt}` : ''}`).join('\n')}
`
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600, s-maxage=3600' } })
}
