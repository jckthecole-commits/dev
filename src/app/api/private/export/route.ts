import { headers } from 'next/headers'
import { auth } from '@/server/auth'
import { exportCustomerData } from '@/server/gdpr'

/** GDPR art. 15/20 — the signed-in customer's own data. */
export async function GET() {
  const s = await auth.api.getSession({ headers: await headers() })
  if (!s) return new Response('Unauthorized', { status: 401 })
  const data = await exportCustomerData(s.user.id)
  return new Response(JSON.stringify(data, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="sifra-vision-date-${new Date().toISOString().slice(0, 10)}.json"`, 'cache-control': 'no-store' },
  })
}
