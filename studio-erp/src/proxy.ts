import { NextResponse, type NextRequest } from 'next/server'

/**
 * Cheap gate: without a session cookie every page except sign-in goes to /autentificare.
 * The real check (valid session, active account, role) happens on the server in each page and action.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.getAll().some((c) => c.name.endsWith('studio.session_token'))
  if (!hasSession) return NextResponse.redirect(new URL('/autentificare', request.url))
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!autentificare|api/auth|_next/static|_next/image|favicon.ico|icon.svg).*)'],
}
