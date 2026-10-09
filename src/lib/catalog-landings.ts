/**
 * SEO landing pages: /rame-de-vedere/<segment> and /ochelari-de-soare/<segment>.
 * Each maps to a preset filter with its own H1, intro and meta description.
 */
import type { CatalogFilters } from './catalog-filters'

export type Landing = { slug: string; title: string; h1: string; intro: string; description: string; preset: Partial<CatalogFilters> }

export const OPTICAL_LANDINGS: Landing[] = [
  { slug: 'rotunde', title: 'Rame de vedere rotunde', h1: 'Rame rotunde.', intro: 'Cercul îmblânzește trăsăturile colțuroase și dă un aer intelectual, relaxat. Merge foarte bine pe fețe pătrate și pe cele cu bărbie pronunțată.', description: 'Rame de vedere rotunde din metal, titan și acetat, cu lentile pe dioptria ta. Dimensiuni reale pe fiecare model, probă virtuală.', preset: { shape: ['round'] } },
  { slug: 'rectangulare', title: 'Rame de vedere rectangulare', h1: 'Rame rectangulare.', intro: 'Linia orizontală alungește optic fața și o face mai echilibrată. Cea mai versatilă formă — de la birou la weekend.', description: 'Rame de vedere rectangulare din acetat, metal și TR90. Compară dimensiunile cu rama ta și vezi prețul complet cu lentile.', preset: { shape: ['rectangular'] } },
  { slug: 'patrate', title: 'Rame de vedere pătrate', h1: 'Rame pătrate.', intro: 'Unghiuri ferme pentru fețe rotunde sau ovale. Lentilele înalte le fac o alegere excelentă pentru progresive.', description: 'Rame de vedere pătrate, potrivite și pentru lentile progresive. Acetat gros sau cristal, dimensiuni detaliate.', preset: { shape: ['square'] } },
  { slug: 'cat-eye', title: 'Rame de vedere cat-eye', h1: 'Rame cat-eye.', intro: 'Colțul exterior ridicat trage privirea în sus și luminează fața. De la discret la declarat.', description: 'Rame de vedere cat-eye din acetat havana, bordo sau cristal. Lentile pe rețetă, probă virtuală din telefon.', preset: { shape: ['cat-eye'] } },
  { slug: 'ovale', title: 'Rame de vedere ovale', h1: 'Rame ovale.', intro: 'Fără colțuri, fără tensiune. Ovalele se potrivesc aproape oricărei fețe și sunt ușor de purtat toată ziua.', description: 'Rame de vedere ovale, ușoare și confortabile. Acetat sau titan semi-rimless.', preset: { shape: ['oval'] } },
  { slug: 'titan', title: 'Rame de vedere din titan', h1: 'Rame din titan.', intro: 'Titanul e ușor, hipoalergenic și nu ruginește. Ramele noastre din titan au între 8 și 13 grame.', description: 'Rame de vedere din titan, ultra-ușoare și hipoalergenice. Rimless, semi-rimless și rotunde.', preset: { material: ['titan'] } },
  { slug: 'acetat', title: 'Rame de vedere din acetat', h1: 'Rame din acetat.', intro: 'Acetatul de celuloză se lustruiește în profunzime și ține culoarea ani de zile. Havana, cristal, fumuriu sau negru.', description: 'Rame de vedere din acetat italian: havana, cristal, fumuriu. Lentile montate și verificate de optometrist.', preset: { material: ['acetat'] } },
  { slug: 'metal', title: 'Rame de vedere din metal', h1: 'Rame din metal.', intro: 'Profil fin, plăcuțe nazale reglabile și o așezare foarte precisă pe nas.', description: 'Rame de vedere din metal cu plăcuțe nazale reglabile. Auriu, argintiu, gunmetal.', preset: { material: ['metal'] } },
  { slug: 'femei', title: 'Rame de vedere pentru femei', h1: 'Rame pentru femei.', intro: 'Cat-eye, ovale sau rotunde, din acetat sau titan. Fiecare cu dimensiuni reale, ca să știi cum stă înainte s-o probezi.', description: 'Rame de vedere pentru femei: cat-eye, ovale, rotunde. Probă virtuală și lentile pe dioptria ta.', preset: { audience: ['women'] } },
  { slug: 'barbati', title: 'Rame de vedere pentru bărbați', h1: 'Rame pentru bărbați.', intro: 'Pătrate, rectangulare, browline sau pilot — inclusiv modele pentru fețe late, cu brațe de 150 mm.', description: 'Rame de vedere pentru bărbați: rectangulare, pătrate, browline, pilot. Modele și pentru fețe late.', preset: { audience: ['men'] } },
  { slug: 'copii', title: 'Rame de vedere pentru copii', h1: 'Rame pentru copii.', intro: 'TR90 flexibil care revine la formă, brațe scurte și culori pe care copiii vor să le poarte.', description: 'Rame de vedere pentru copii din TR90 flexibil. Rezistente, ușoare, colorate.', preset: { audience: ['kids'] } },
  { slug: 'progresive', title: 'Rame potrivite pentru lentile progresive', h1: 'Rame pentru progresive.', intro: 'Toate ramele de aici au lentila înaltă de cel puțin 28 mm — suficient pentru zonele de departe, intermediar și aproape.', description: 'Rame de vedere potrivite pentru lentile progresive (înălțime lentilă ≥ 28 mm).', preset: { feature: ['progresive'] } },
]

export const SUN_LANDINGS: Landing[] = [
  { slug: 'polarizati', title: 'Ochelari de soare polarizați', h1: 'Polarizați.', intro: 'Lentilele polarizate taie reflexiile de pe apă, asfalt și zăpadă. Pentru condus, pescuit și vacanțe la mare.', description: 'Ochelari de soare polarizați, categoria 3, UV400. Disponibili și cu dioptrii.', preset: { feature: ['polarizat'] } },
  { slug: 'aviator', title: 'Ochelari de soare aviator', h1: 'Aviator.', intro: 'Forma pilot cu punte dublă — clasicul care nu se demodează.', description: 'Ochelari de soare aviator din metal, cu lentile verde G-15 sau gri, polarizate.', preset: { shape: ['pilot'] } },
  { slug: 'femei', title: 'Ochelari de soare pentru femei', h1: 'Pentru femei.', intro: 'Cat-eye, ovali și rotunzi, cu lentile degradé sau polarizate.', description: 'Ochelari de soare pentru femei: cat-eye, ovali, degradé.', preset: { audience: ['women'] } },
  { slug: 'barbati', title: 'Ochelari de soare pentru bărbați', h1: 'Pentru bărbați.', intro: 'Pătrați, rectangulari și aviator, inclusiv modele sport din TR90.', description: 'Ochelari de soare pentru bărbați: pătrați, rectangulari, aviator, sport.', preset: { audience: ['men'] } },
]

export function findLanding(category: 'optical' | 'sun', slug: string) {
  return (category === 'optical' ? OPTICAL_LANDINGS : SUN_LANDINGS).find((l) => l.slug === slug) ?? null
}
