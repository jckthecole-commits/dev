import type { MetadataRoute } from 'next'
import { abs, SITE_URL } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  const production = process.env.NODE_ENV === 'production' && !/localhost|staging|preview/.test(SITE_URL)
  if (!production) return { rules: [{ userAgent: '*', disallow: '/' }] }
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/imagini/', '/media/'],
        disallow: ['/admin', '/api/', '/cont', '/cos', '/checkout', '/comanda/', '/plata/', '/b2b/portal', '/programare/', '/configurator/', '/favorite', '/cautare', '/*?*sort=', '/*?*pagina='],
      },
    ],
    sitemap: abs('/sitemap.xml'),
    host: SITE_URL,
  }
}
