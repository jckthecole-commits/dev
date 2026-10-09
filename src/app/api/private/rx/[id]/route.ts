import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { prescription } from '@/lib/db/schema'
import { audit } from '@/server/audit'
import { can, getCurrentUser } from '@/server/session'
import { readPrivateFile } from '@/server/storage'

/** Decrypts and streams a prescription upload. Staff with rx permission or the owner only. Every access is audited. */
export async function GET(_: Request, { params }: RouteContext<'/api/private/rx/[id]'>) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const rx = await db.query.prescription.findFirst({ where: eq(prescription.id, id) })
  if (!rx?.fileKey) return new Response('Not found', { status: 404 })
  const staff = can(user.role, 'orders:read')
  if (!staff && rx.userId !== user.id) return new Response('Forbidden', { status: 403 })
  const buf = await readPrivateFile(rx.fileKey)
  if (!buf) return new Response('Not found', { status: 404 })
  await audit(user, 'rx.file.view', 'prescription', rx.id)
  return new Response(new Uint8Array(buf), {
    headers: { 'content-type': rx.fileMime ?? 'application/octet-stream', 'cache-control': 'private, no-store', 'content-disposition': 'inline', 'x-content-type-options': 'nosniff' },
  })
}
