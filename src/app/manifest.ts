import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sifra Vision — rame de vedere și ochelari de soare',
    short_name: 'Sifra Vision',
    description: 'Rame și lentile pe dioptria ta, probă virtuală și showroom în Galați.',
    lang: 'ro',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#EEF1EF',
    theme_color: '#EEF1EF',
    categories: ['shopping', 'health'],
    icons: [
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'any' },
      { src: '/icons/192', type: 'image/png', sizes: '192x192', purpose: 'any' },
      { src: '/icons/512', type: 'image/png', sizes: '512x512', purpose: 'any' },
      { src: '/icons/512-maskable', type: 'image/png', sizes: '512x512', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Rame de vedere', url: '/rame-de-vedere' },
      { name: 'Probă virtuală', url: '/proba-virtuala' },
      { name: 'Programare', url: '/programare' },
    ],
  }
}
