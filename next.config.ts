import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV !== 'production'

/**
 * Content-Security-Policy.
 * Static shells (Cache Components / PPR) are served from cache, so a per-request
 * nonce is not possible — inline scripts are allowed, everything else is pinned
 * to an explicit allow-list. Third-party analytics are only *loaded* after
 * cookie consent (see src/components/consent).
 */
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''} https://cdn.jsdelivr.net https://www.googletagmanager.com https://connect.facebook.net`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self' data:`,
  `connect-src 'self' https://cdn.jsdelivr.net https://storage.googleapis.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.facebook.com${isDev ? ' ws: http://localhost:*' : ''}`,
  `media-src 'self' blob: mediastream:`,
  `worker-src 'self' blob:`,
  `frame-src 'self' https://www.openstreetmap.org https://www.google.com`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self' https://secure.netopia-payments.com https://secure-sandbox.netopia-payments.com https://checkout.stripe.com`,
  `object-src 'none'`,
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(), geolocation=(), payment=(self), gyroscope=(self), accelerometer=(self), magnetometer=(), usb=(), interest-cohort=()',
  },
]

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  output: 'standalone',
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    localPatterns: [{ pathname: '/media/**' }, { pathname: '/images/**' }],
  },
  experimental: {
    authInterrupts: true,
    instantInsights: { validationLevel: 'manual-warning' },
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // Private health data (prescriptions) and account areas are never cached by intermediaries.
        source: '/(cont|admin|b2b/portal|api/private)/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
    ]
  },
  async redirects() {
    return [
      { source: '/rame', destination: '/rame-de-vedere', permanent: true },
      { source: '/ochelari-vedere', destination: '/rame-de-vedere', permanent: true },
      { source: '/soare', destination: '/ochelari-de-soare', permanent: true },
      { source: '/login', destination: '/cont/autentificare', permanent: false },
    ]
  },
}

export default nextConfig
