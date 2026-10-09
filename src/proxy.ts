import { NextResponse, type NextRequest } from 'next/server'
import { CLIENT_IP_HEADER, clientIpFrom } from '@/lib/client-ip'

/**
 * Resolves the client IP once, from the trusted proxy hop, and hands it to the
 * app (rate limits, Better Auth, audit log) in a header the client cannot set.
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers)
  const ip = clientIpFrom(request.headers)
  if (ip) headers.set(CLIENT_IP_HEADER, ip)
  else headers.delete(CLIENT_IP_HEADER)
  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|vendor/|imagini/|icons/|favicon.ico|icon.svg|apple-icon|opengraph-image).*)'],
}
