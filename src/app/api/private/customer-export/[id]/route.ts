import { audit } from '@/server/audit'
import { exportCustomerData } from '@/server/gdpr'
import { can, getCurrentUser } from '@/server/session'

/** Staff-side GDPR export (answering a data-subject request received by e-mail / in store). */
export async function GET(_: Request, { params }: RouteContext<'/api/private/customer-export/[id]'>) {
  const me = await getCurrentUser()
  if (!me || !can(me.role, 'reports:read')) return new Response('Forbidden', { status: 403 })
  const { id } = await params
  const data = await exportCustomerData(id)
  if (!data.user) return new Response('Not found', { status: 404 })
  await audit(me, 'gdpr.export', 'user', id)
  return new Response(JSON.stringify(data, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="export-${id.slice(0, 8)}.json"`, 'cache-control': 'no-store' },
  })
}
