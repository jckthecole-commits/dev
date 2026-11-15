export const ROLES = ['admin', 'manager', 'trainer', 'model'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABEL: Record<Role, string> = { admin: 'Administrator', manager: 'Manager', trainer: 'Trainer', model: 'Model' }

/** What each role may do. Trainers only ever see the models assigned to them. */
export const CAN = {
  'models:read': ['admin', 'manager', 'trainer'],
  'models:write': ['admin', 'manager'],
  'models:sensitive': ['admin', 'manager'],
  'schedule:read': ['admin', 'manager', 'trainer'],
  'schedule:write': ['admin', 'manager'],
  'earnings:read': ['admin', 'manager'],
  'earnings:write': ['admin', 'manager'],
  'payroll:read': ['admin', 'manager'],
  'payroll:write': ['admin', 'manager'],
  'payroll:close': ['admin'],
  'team:write': ['admin'],
  'settings:write': ['admin'],
  'audit:read': ['admin'],
} as const satisfies Record<string, readonly Role[]>
export type Permission = keyof typeof CAN

export function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v)
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return !!role && (CAN[permission] as readonly Role[]).includes(role)
}

export const isStaff = (role: Role | null | undefined) => !!role && role !== 'model'
