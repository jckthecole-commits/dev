import 'server-only'
import { eq } from 'drizzle-orm'
import { model } from '@/lib/db/schema'
import type { SessionUser } from './session'

/** Trainers only see the models assigned to them; managers and admins see everyone. */
export const modelScope = (u: SessionUser) => (u.role === 'trainer' ? eq(model.trainerId, u.id) : undefined)
