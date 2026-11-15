import 'server-only'
import { headers } from 'next/headers'
import { forbidden, redirect } from 'next/navigation'
import { cache } from 'react'
import { can, isRole, type Permission, type Role } from '@/lib/roles'
import { auth } from './auth'

export type SessionUser = { id: string; name: string; email: string; role: Role }

/** Current user, deduplicated per request. Deactivated accounts count as signed out. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const s = await auth.api.getSession({ headers: await headers() })
  if (!s) return null
  const u = s.user as typeof s.user & { role?: string; active?: boolean }
  if (u.active === false || !isRole(u.role)) return null
  return { id: u.id, name: u.name, email: u.email, role: u.role }
})

export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser()
  if (!u) redirect('/autentificare')
  return u
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const u = await requireUser()
  if (!can(u.role, permission)) forbidden()
  return u
}
