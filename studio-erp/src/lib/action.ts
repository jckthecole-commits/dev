/** What every server action returns to its form. */
export type ActionState = { ok: boolean; message?: string; errors?: Record<string, string>; at?: number }
export const initialState: ActionState = { ok: false }

export const ok = (message?: string): ActionState => ({ ok: true, message, at: Date.now() })
export const fail = (message: string, errors?: Record<string, string>): ActionState => ({ ok: false, message, errors, at: Date.now() })

/** Zod issues → { field: first message } */
export function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const i of issues) {
    const k = String(i.path[0] ?? '_')
    out[k] ??= i.message
  }
  return out
}
