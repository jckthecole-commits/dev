import { ImageResponse } from 'next/og'
import { AppIcon } from '@/server/app-icon'

/** PWA icons: /icons/192, /icons/512, /icons/512-maskable */
export async function GET(_: Request, { params }: RouteContext<'/icons/[variant]'>) {
  const { variant } = await params
  const [s, kind] = variant.split('-')
  const size = s === '192' ? 192 : s === '512' ? 512 : 0
  if (!size) return new Response('Not found', { status: 404 })
  const maskable = kind === 'maskable'
  const res = new ImageResponse(<AppIcon size={size} pad={maskable ? 0.26 : 0.16} radius={maskable ? 0 : 0.22} />, { width: size, height: size })
  res.headers.set('cache-control', 'public, max-age=604800, immutable')
  return res
}
