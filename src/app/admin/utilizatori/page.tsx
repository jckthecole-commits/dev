import { asc, inArray, sql } from 'drizzle-orm'
import { Suspense } from 'react'
import { changeRoleForm, inviteStaff, revokeSessions } from '@/app/admin/_actions/people'
import { ActionButton } from '@/components/admin/action-button'
import { AdminForm } from '@/components/admin/form'
import { Badge, Field, input, PageHeader, Panel, Table } from '@/components/admin/ui'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { formatDateTime } from '@/lib/format'
import { CAN, requireStaff, STAFF_ROLES, type Permission } from '@/server/session'

export const metadata = { title: 'Echipă & roluri' }

const ROLE: Record<string, { label: string; desc: string }> = {
  staff: { label: 'Consultant', desc: 'Comenzi, programări, mesaje' },
  optometrist: { label: 'Optometrist', desc: '+ verificare rețete' },
  manager: { label: 'Manager', desc: '+ catalog, conținut, parteneri, rapoarte' },
  admin: { label: 'Administrator', desc: '+ setări, integrări, echipă' },
}
const PERM_LABEL: Record<Permission, string> = {
  'orders:read': 'Vede comenzi',
  'orders:write': 'Procesează comenzi',
  'rx:verify': 'Verifică rețete',
  'catalog:write': 'Editează catalog & prețuri',
  'content:write': 'Pagini, jurnal, recenzii',
  'partners:write': 'Aprobă parteneri B2B',
  'settings:write': 'Setări magazin',
  'users:write': 'Gestionează echipa',
  'appointments:write': 'Gestionează programări',
  'reports:read': 'Rapoarte, export, GDPR',
}

export default function Team() {
  return (
    <Suspense fallback={<div className="skeleton h-[500px]" />}>
      <List />
    </Suspense>
  )
}

async function List() {
  const me = await requireStaff('users:write')
  const staff = await db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt, lastSeen: sql<string | null>`(select max(s.updated_at) from session s where s.user_id = "user"."id")`, hasPassword: sql<boolean>`exists (select 1 from account a where a.user_id = "user"."id")` })
    .from(user)
    .where(inArray(user.role, STAFF_ROLES))
    .orderBy(asc(user.name))
  return (
    <>
      <PageHeader eyebrow="Platformă" title="Echipă & roluri" />
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Panel pad={false}>
          <Table>
            <thead><tr><th>Membru</th><th>Rol</th><th>Ultima activitate</th><th /></tr></thead>
            <tbody>
              {staff.map((u) => (
                <tr key={u.id}>
                  <td><span className="font-bold">{u.name}</span>{u.id === me.id ? <Badge tone="info" className="ml-2">tu</Badge> : null}<div className="text-[13px] text-graphite">{u.email}</div></td>
                  <td>
                    {u.id === me.id ? (
                      <span className="text-[14px]">{ROLE[u.role ?? '']?.label}</span>
                    ) : (
                      <AdminForm action={changeRoleForm.bind(null, u.id)} inline submit="Aplică">
                        <select name="role" defaultValue={u.role ?? 'staff'} className="field h-9 w-44 text-[13.5px]" aria-label={`Rol ${u.name}`}>
                          {Object.entries(ROLE).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
                          <option value="customer">— Revocă accesul</option>
                        </select>
                      </AdminForm>
                    )}
                  </td>
                  <td className="text-[13.5px]">{u.lastSeen ? formatDateTime(u.lastSeen) : u.hasPassword ? '—' : <Badge tone="warn">invitație trimisă</Badge>}</td>
                  <td className="text-right">{u.id !== me.id ? <ActionButton action={revokeSessions.bind(null, u.id)} variant="ghost" confirm={`Deconectezi ${u.name} de pe toate dispozitivele?`}>Deconectează</ActionButton> : null}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
        <div className="flex flex-col gap-6">
          <Panel title="Invită un coleg">
            <AdminForm action={inviteStaff} submit="Trimite invitația">
              <Field label="Nume"><input name="name" required className={input} /></Field>
              <Field label="E-mail"><input name="email" type="email" required className={input} /></Field>
              <Field label="Rol">
                <select name="role" defaultValue="staff" className={input}>{Object.entries(ROLE).map(([k, r]) => <option key={k} value={k}>{r.label} — {r.desc}</option>)}</select>
              </Field>
            </AdminForm>
          </Panel>
          <Panel title="Ce poate fiecare rol">
            <table className="w-full text-[13px]">
              <thead><tr className="text-left font-mono text-[10.5px] uppercase tracking-[0.06em] text-graphite"><th className="py-1 font-normal" />{Object.values(ROLE).map((r) => <th key={r.label} className="px-1 py-1 text-center font-normal">{r.label.slice(0, 5)}</th>)}</tr></thead>
              <tbody>
                {(Object.keys(PERM_LABEL) as Permission[]).map((p) => (
                  <tr key={p} className="border-t border-line-soft">
                    <td className="py-1.5 pr-2">{PERM_LABEL[p]}</td>
                    {Object.keys(ROLE).map((r) => <td key={r} className="text-center">{(CAN[p] as readonly string[]).includes(r) ? <span className="text-ok" aria-label="da">●</span> : <span className="text-line" aria-label="nu">○</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      </div>
    </>
  )
}
