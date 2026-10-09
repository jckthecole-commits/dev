import { getObject } from '@/server/storage'

const TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', pdf: 'application/pdf' }

/** Public uploads (product images, documents) from local storage or S3. Keys are random → cache forever. */
export async function GET(_: Request, { params }: RouteContext<'/media/[...key]'>) {
  const { key } = await params
  if (key.some((k) => !k || k === '..' || k.startsWith('.'))) return new Response('Not found', { status: 404 })
  const ext = key.at(-1)!.split('.').pop()!.toLowerCase()
  const type = TYPES[ext]
  if (!type) return new Response('Not found', { status: 404 })
  const body = await getObject(`public/${key.join('/')}`)
  if (!body) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(body), {
    headers: {
      'content-type': type,
      'content-length': String(body.length),
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
      ...(type === 'application/pdf' ? { 'content-disposition': 'inline' } : {}),
    },
  })
}
