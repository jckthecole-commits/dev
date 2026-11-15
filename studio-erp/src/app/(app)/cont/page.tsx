import type { Metadata } from 'next'
import { Card, PageHeader } from '@/components/ui'
import { ROLE_LABEL } from '@/lib/roles'
import { requireUser } from '@/server/session'
import { PasswordForm } from './password-form'

export const metadata: Metadata = { title: 'Contul meu' }

export default async function AccountPage() {
  const me = await requireUser()
  return (
    <>
      <PageHeader title="Contul meu" />
      <div className="grid max-w-3xl gap-6 md:grid-cols-2">
        <Card title="Profil">
          <dl className="space-y-2 text-sm">
            <div><dt className="text-muted">Nume</dt><dd>{me.name}</dd></div>
            <div><dt className="text-muted">E-mail</dt><dd className="break-all">{me.email}</dd></div>
            <div><dt className="text-muted">Rol</dt><dd>{ROLE_LABEL[me.role]}</dd></div>
          </dl>
        </Card>
        <Card title="Schimbă parola">
          <PasswordForm />
        </Card>
      </div>
    </>
  )
}
