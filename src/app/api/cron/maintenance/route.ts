import { safeEqual } from '@/lib/crypto'
import { runMaintenance } from '@/server/maintenance'

/**
 * Scheduled housekeeping. Call every 15 minutes with
 *   Authorization: Bearer $CRON_SECRET
 * (Vercel Cron sends this header automatically; on a VPS use crontab + curl).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new Response('Unauthorized', { status: 401 })
  const report = await runMaintenance()
  return Response.json({ ok: true, at: new Date().toISOString(), ...report }, { headers: { 'cache-control': 'no-store' } })
}
