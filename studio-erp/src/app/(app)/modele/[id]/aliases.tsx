'use client'

import { useTransition } from 'react'
import { ActionForm } from '@/components/action-form'
import { Button, Input, Select } from '@/components/ui'
import type { ActionState } from '@/lib/action'

export function Aliases({
  aliases,
  platforms,
  add,
  remove,
  canEdit,
}: {
  aliases: { id: string; platform: string; username: string }[]
  platforms: { id: string; name: string }[]
  add: (prev: ActionState, f: FormData) => Promise<ActionState>
  remove: (id: string) => Promise<ActionState>
  canEdit: boolean
}) {
  const [pending, start] = useTransition()
  return (
    <div className="space-y-3">
      {aliases.length === 0 ? <p className="text-sm text-muted">Niciun utilizator legat. Importul CSV recunoaște modelul după numele de scenă sau după aceste nume.</p> : null}
      <ul className="divide-y divide-line">
        {aliases.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <span>
              <span className="text-muted">{a.platform}:</span> {a.username}
            </span>
            {canEdit ? (
              <Button variant="ghost" small disabled={pending} onClick={() => start(async () => void (await remove(a.id)))} aria-label={`Șterge ${a.username}`}>
                Șterge
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {canEdit && platforms.length ? (
        <ActionForm action={add} resetOnSuccess className="flex flex-wrap gap-2">
          <Select name="platformId" className="w-auto" required>
            {platforms.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          <Input name="username" placeholder="utilizator pe platformă" required className="min-w-0 flex-1" />
          <Button type="submit" variant="secondary">Leagă</Button>
        </ActionForm>
      ) : null}
    </div>
  )
}
