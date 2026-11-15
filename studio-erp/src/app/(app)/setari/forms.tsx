'use client'

import { useState, useTransition } from 'react'
import { ActionForm } from '@/components/action-form'
import { Badge, Button, Field, Input, Select } from '@/components/ui'
import type { ActionState } from '@/lib/action'

type Action = (p: ActionState, f: FormData) => Promise<ActionState>

export function StudioForm({ action, studioName, rate }: { action: Action; studioName: string; rate: string }) {
  return (
    <ActionForm action={action} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
      <Field label="Numele studioului"><Input name="studioName" defaultValue={studioName} required /></Field>
      <Field label="Curs implicit USD → RON"><Input name="rate" defaultValue={rate} inputMode="decimal" required /></Field>
      <Button type="submit">Salvează</Button>
    </ActionForm>
  )
}

export function NamedList({
  items,
  add,
  toggle,
  placeholder,
}: {
  items: { id: string; name: string; active: boolean; detail?: string }[]
  add: Action
  toggle: (id: string, active: boolean) => Promise<ActionState>
  placeholder: string
}) {
  const [pending, start] = useTransition()
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-line">
        {items.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <span className={i.active ? '' : 'text-muted line-through'}>
              {i.name} {i.detail ? <span className="text-muted">{i.detail}</span> : null}
            </span>
            <Button variant="ghost" small disabled={pending} onClick={() => start(async () => void (await toggle(i.id, !i.active)))}>
              {i.active ? 'Dezactivează' : 'Activează'}
            </Button>
          </li>
        ))}
      </ul>
      <ActionForm action={add} resetOnSuccess className="flex gap-2">
        <Input name="name" placeholder={placeholder} required className="min-w-0 flex-1" />
        <Button type="submit" variant="secondary">Adaugă</Button>
      </ActionForm>
    </div>
  )
}

export function ShiftForm({ action }: { action: Action }) {
  return (
    <ActionForm action={action} resetOnSuccess className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_7rem_7rem_auto] sm:items-end">
      <Field label="Nume" className="col-span-2 sm:col-span-1"><Input name="name" placeholder="ex. Seara" required /></Field>
      <Field label="Început"><Input name="start" type="time" required /></Field>
      <Field label="Sfârșit"><Input name="end" type="time" required /></Field>
      <Button type="submit" variant="secondary" className="col-span-2 sm:col-span-1">Adaugă</Button>
    </ActionForm>
  )
}

type Tier = { from: string; pct: string }

export function PlanForm({
  action,
  plan,
}: {
  action: Action
  plan?: { name: string; mode: 'whole' | 'progressive'; isDefault: boolean; tiers: Tier[] }
}) {
  const [tiers, setTiers] = useState<Tier[]>(plan?.tiers ?? [{ from: '0', pct: '50' }])
  return (
    <ActionForm action={action} resetOnSuccess={!plan}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nume plan"><Input name="name" defaultValue={plan?.name} required /></Field>
          <Field label="Mod de calcul" hint="Progresiv: fiecare procent doar pe tranșa lui.">
            <Select name="mode" defaultValue={plan?.mode ?? 'whole'}>
              <option value="whole">Pragul atins se aplică la tot</option>
              <option value="progressive">Progresiv pe tranșe</option>
            </Select>
          </Field>
        </div>
        <div>
          <div className="mb-1 grid grid-cols-[1fr_6rem_2rem] gap-2 text-xs text-muted"><span>De la brut lunar (USD)</span><span>Procent</span><span /></div>
          {tiers.map((t, i) => (
            <div key={i} className="mb-2 grid grid-cols-[1fr_6rem_2rem] gap-2">
              <Input name="from" value={t.from} readOnly={i === 0} inputMode="decimal" aria-label={`Prag ${i + 1}`} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))} />
              <Input name="pct" value={t.pct} inputMode="decimal" aria-label={`Procent ${i + 1}`} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, pct: e.target.value } : x)))} />
              {i > 0 ? (
                <button type="button" aria-label="Șterge pragul" className="text-muted hover:text-bad" onClick={() => setTiers(tiers.filter((_, j) => j !== i))}>×</button>
              ) : <span />}
            </div>
          ))}
          <Button type="button" variant="ghost" small onClick={() => setTiers([...tiers, { from: '', pct: '' }])}>+ prag</Button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isDefault" defaultChecked={plan?.isDefault} className="size-4 accent-[var(--accent)]" />
          Plan implicit (pentru modelele fără plan ales)
        </label>
        <Button type="submit" variant={plan ? 'secondary' : 'primary'}>{plan ? 'Salvează planul' : 'Creează plan'}</Button>
      </div>
    </ActionForm>
  )
}

export function PlanCard({ name, isDefault, summary, children }: { name: string; isDefault: boolean; summary: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium">{name} {isDefault ? <Badge tone="accent">implicit</Badge> : null}</div>
          <div className="text-sm text-muted">{summary}</div>
        </div>
        <Button variant="ghost" small onClick={() => setOpen(!open)}>{open ? 'Închide' : 'Editează'}</Button>
      </div>
      {open ? <div className="mt-3">{children}</div> : null}
    </li>
  )
}
