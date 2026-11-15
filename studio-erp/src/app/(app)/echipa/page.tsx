import { asc, ne, sql } from 'drizzle-orm'
import type { Metadata } from 'next'
import { Card, PageHeader } from '@/components/ui'
import { db } from '@/lib/db'
import { model, user } from '@/lib/db/schema'
import { requirePermission } from '@/server/session'
import { addMember, resetMemberPassword, setMemberActive, updateMember } from './actions'
import { AddMemberForm, MemberRow } from './forms'

export const metadata: Metadata = { title: 'Echipă' }

export default async function TeamPage() {
  const me = await requirePermission('team:write')
  const members = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      phone: user.phone,
      // drizzle leaves columns unqualified in a single-table select, so the subquery names its own alias
      models: sql<number>`(select count(*) from ${model} m where m.trainer_id = "user"."id" and m.status <> 'left')::int`,
    })
    .from(user)
    .where(ne(user.role, 'model'))
    .orderBy(sql`${user.active} desc`, asc(user.name))

  return (
    <>
      <PageHeader title="Echipă" subtitle="Administratori, manageri și traineri. Conturile modelelor se fac din fișa fiecărui model." />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card title={`${members.length} membri`}>
          <ul className="-my-4 divide-y divide-line">
            {members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                isSelf={m.id === me.id}
                updateRole={updateMember.bind(null, m.id)}
                setActive={setMemberActive.bind(null, m.id)}
                resetPassword={resetMemberPassword.bind(null, m.id)}
              />
            ))}
          </ul>
        </Card>
        <Card title="Membru nou">
          <AddMemberForm action={addMember} />
        </Card>
      </div>
      <p className="mt-6 text-xs text-muted">
        Administrator: tot, inclusiv setări, echipă și închiderea lunii. Manager: modele, orar, încasări, plăți. Trainer: doar modelele lui și orarul, fără sume.
      </p>
    </>
  )
}
