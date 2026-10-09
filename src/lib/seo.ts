import type { StoreSettings } from './settings-schema'
import { WEEKDAYS_RO } from './settings-schema'

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
export const abs = (path: string) => (path.startsWith('http') ? path : `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`)

const DAY_SCHEMA = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function organizationLd(s: StoreSettings) {
  const sameAs = Object.values(s.company.social).filter(Boolean)
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: s.company.brand,
    legalName: s.company.legalName,
    url: SITE_URL,
    logo: abs('/icon.svg'),
    email: s.company.email,
    ...(s.company.phone ? { telephone: s.company.phone } : {}),
    ...(s.company.cui ? { taxID: s.company.cui, vatID: s.company.cui } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  }
}

export function websiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: 'Sifra Vision',
    inLanguage: 'ro-RO',
    publisher: { '@id': `${SITE_URL}/#organization` },
    potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/cautare?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
  }
}

/** schema.org/Optician (a MedicalBusiness / LocalBusiness) for the Galați showroom. */
export function opticianLd(s: StoreSettings) {
  const c = s.company
  return {
    '@context': 'https://schema.org',
    '@type': ['Optician', 'Store'],
    '@id': `${SITE_URL}/showroom-galati#store`,
    name: `${c.brand} — showroom Galați`,
    url: abs('/showroom-galati'),
    image: abs('/opengraph-image'),
    parentOrganization: { '@id': `${SITE_URL}/#organization` },
    priceRange: '189–549 lei (rame)',
    currenciesAccepted: 'RON',
    paymentAccepted: 'Numerar, card',
    ...(c.phone ? { telephone: c.phone } : {}),
    email: c.email,
    address: { '@type': 'PostalAddress', streetAddress: c.address, addressLocality: c.city, addressRegion: c.county, ...(c.postalCode ? { postalCode: c.postalCode } : {}), addressCountry: 'RO' },
    ...(c.geo.lat && c.geo.lng ? { geo: { '@type': 'GeoCoordinates', latitude: c.geo.lat, longitude: c.geo.lng } } : {}),
    hasMap: c.mapsUrl,
    openingHoursSpecification: s.hours.weekly
      .filter((d): d is { day: number; open: string; close: string } => !('closed' in d))
      .map((d) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: `https://schema.org/${DAY_SCHEMA[d.day]}`, opens: d.open, closes: d.close })),
    availableService: [
      { '@type': 'MedicalProcedure', name: 'Consultație optometrică' },
      { '@type': 'Service', name: 'Montaj lentile de vedere' },
    ],
  }
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) })),
  }
}

export function faqLd(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
  }
}

export function articleLd(a: { title: string; slug: string; excerpt: string | null; publishedAt: Date | null; updatedAt: Date }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.excerpt ?? undefined,
    mainEntityOfPage: abs(`/jurnal/${a.slug}`),
    image: abs(`/jurnal/${a.slug}/opengraph-image`),
    datePublished: a.publishedAt?.toISOString(),
    dateModified: a.updatedAt.toISOString(),
    inLanguage: 'ro-RO',
    author: { '@type': 'Organization', name: 'Sifra Vision', url: SITE_URL },
    publisher: { '@id': `${SITE_URL}/#organization` },
  }
}

export type ProductLdInput = {
  slug: string
  name: string
  description: string
  modelCode: string
  category: 'optical' | 'sun'
  material: string
  shape: string
  audience: string
  lensWidth: number
  bridgeWidth: number
  templeLength: number
  weightGrams: number | null
  price: number
  variants: { sku: string; colorName: string; colorSlug: string; ean: string | null; available: number; priceDelta: number }[]
  rating: { count: number; avg: number | null }
}

/**
 * ProductGroup with colour variants (Google merchant listings, 2024+ variant support).
 * Each variant is a Product with its own Offer, shipping details and return policy.
 */
export function productGroupLd(p: ProductLdInput, s: StoreSettings) {
  const url = abs(`/rame/${p.slug}`)
  const shippingDetails = {
    '@type': 'OfferShippingDetails',
    shippingRate: { '@type': 'MonetaryAmount', value: (s.shipping.courier.price / 100).toFixed(2), currency: 'RON' },
    shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'RO' },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: s.policies.productionDaysMax, unitCode: 'DAY' },
      transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY' },
    },
  }
  const returnPolicy = {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'RO',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: s.policies.returnDays,
    returnMethod: ['https://schema.org/ReturnByMail', 'https://schema.org/ReturnInStore'],
    returnFees: 'https://schema.org/FreeReturn',
  }
  const gender = p.audience === 'women' ? 'https://schema.org/Female' : p.audience === 'men' ? 'https://schema.org/Male' : undefined
  return {
    '@context': 'https://schema.org',
    '@type': 'ProductGroup',
    '@id': `${url}#product`,
    name: p.name,
    description: p.description,
    url,
    brand: { '@type': 'Brand', name: 'SIFRA' },
    productGroupID: p.modelCode,
    variesBy: ['https://schema.org/color'],
    category: p.category === 'sun' ? 'Apparel & Accessories > Clothing Accessories > Sunglasses' : 'Health & Beauty > Personal Care > Vision Care > Eyeglasses',
    material: p.material,
    ...(gender ? { audience: { '@type': 'PeopleAudience', suggestedGender: gender } } : {}),
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Lățime lentilă', value: p.lensWidth, unitCode: 'MMT' },
      { '@type': 'PropertyValue', name: 'Punte', value: p.bridgeWidth, unitCode: 'MMT' },
      { '@type': 'PropertyValue', name: 'Lungime braț', value: p.templeLength, unitCode: 'MMT' },
      { '@type': 'PropertyValue', name: 'Formă', value: p.shape },
    ],
    ...(p.rating.count > 0 && p.rating.avg ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating.avg.toFixed(1), reviewCount: p.rating.count } } : {}),
    hasVariant: p.variants.map((v) => ({
      '@type': 'Product',
      '@id': `${url}?culoare=${v.colorSlug}#variant`,
      name: `${p.name} — ${v.colorName}`,
      sku: v.sku,
      ...(v.ean ? { gtin13: v.ean } : {}),
      mpn: v.sku,
      color: v.colorName,
      image: abs(`/rame/${p.slug}/opengraph-image`),
      ...(p.weightGrams ? { weight: { '@type': 'QuantitativeValue', value: p.weightGrams, unitCode: 'GRM' } } : {}),
      offers: {
        '@type': 'Offer',
        url: `${url}?culoare=${v.colorSlug}`,
        priceCurrency: 'RON',
        price: ((p.price + v.priceDelta) / 100).toFixed(2),
        itemCondition: 'https://schema.org/NewCondition',
        availability: v.available > 0 ? 'https://schema.org/InStock' : 'https://schema.org/BackOrder',
        seller: { '@id': `${SITE_URL}/#organization` },
        shippingDetails,
        hasMerchantReturnPolicy: returnPolicy,
      },
    })),
  }
}

export const weekdayLabel = (d: number) => WEEKDAYS_RO[d]
