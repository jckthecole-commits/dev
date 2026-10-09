import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { document } from '@/lib/db/schema'
import { audit } from '@/server/audit'
import { getMyPartner } from '@/server/b2b'
import { getCurrentUser, isStaff } from '@/server/session'
import { readPrivateFile } from '@/server/storage'

/** Documents by audience: public → anyone · b2b → approved partners + staff · internal → staff. */
export async function GET(_: Request, { params }: RouteContext<'/api/private/document/[id]'>) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response('Not found', { status: 404 })
  const doc = await db.query.document.findFirst({ where: eq(document.id, id) })
  if (!doc) return new Response('Not found', { status: 404 })
  if (doc.audience !== 'public') {
    const user = await getCurrentUser()
    const staff = isStaff(user?.role)
    const allowed = staff || (doc.audience === 'b2b' && !!(await getMyPartner()))
    if (!allowed) return new Response(user ? 'Forbidden' : 'Unauthorized', { status: user ? 403 : 401 })
    if (user) await audit(user, 'document.download', 'document', doc.id)
  }
  const body = await readPrivateFile(doc.fileKey)
  if (!body) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(body), {
    headers: {
      'content-type': doc.mime,
      'content-length': String(body.length),
      'content-disposition': `${doc.mime === 'application/pdf' || doc.mime.startsWith('image/') ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      'cache-control': doc.audience === 'public' ? 'public, max-age=3600' : 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  })
}
