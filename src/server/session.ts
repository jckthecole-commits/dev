import 'server-only'
import { headers } from 'next/headers'
import { forbidden, redirect } from 'next/navigation'
import { cache } from 'react'
import { auth } from './auth'

export type Role = 'customer' | 'partner' | 'staff' | 'optometrist' | 'manager' | 'admin'
export type SessionUser = { id: string; name: string; email: string; role: Role; phone: string | null }

/** Staff roles and what they may do. */
export const STAFF_ROLES: Role[] = ['staff', 'optometrist', 'manager', 'admin']
const CAN: Record<string, Role[]> = {
  'orders:read': STAFF_ROLES,
  'orders:write': STAFF_ROLES,
  'rx:verify': ['optometrist', 'manager', 'admin'],
  'catalog:write': ['manager', 'admin'],
  'content:write': ['manager', 'admin'],
  'partners:write': ['manager', 'admin'],
  'settings:write': ['admin'],
  'users:write': ['admin'],
  'appointments:write': STAFF_ROLES,
  'reports:read': ['manager', 'admin'],
}
export type Permission = keyof typeof CAN

export function can(role: Role | undefined | null, permission: Permission) {
  return !!role && (CAN[permission] ?? []).includes(role)
}

/** Current user (request-scoped, deduplicated per render). Reads request headers → call inside <Suspense>. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const s = await auth.api.getSession({ headers: await headers() })
  if (!s) return null
  const u = s.user as typeof s.user & { role?: string; phone?: string | null }
  return { id: u.id, name: u.name, email: u.email, role: (u.role as Role) ?? 'customer', phone: u.phone ?? null }
})

export async function requireUser(next = '/cont'): Promise<SessionUser> {
  const u = await getCurrentUser()
  if (!u) redirect(`/cont/autentificare?next=${encodeURIComponent(next)}`)
  return u
}

export async function requireStaff(permission: Permission = 'orders:read'): Promise<SessionUser> {
  const u = await getCurrentUser()
  if (!u) redirect('/cont/autentificare?next=/admin')
  if (!can(u.role, permission)) forbidden()
  return u
}

export const isStaff = (role?: Role | null) => !!role && STAFF_ROLES.includes(role)
