import { AppNav, type NavGroup } from '@/components/nav'
import { can, ROLE_LABEL, type Role } from '@/lib/roles'
import { getSettings } from '@/server/settings'
import { requireUser } from '@/server/session'

function navFor(role: Role): NavGroup[] {
  if (role === 'model') {
    return [{ title: 'Contul meu', items: [{ href: '/', label: 'Acasă', icon: 'home' }, { href: '/cont', label: 'Profil și parolă', icon: 'user' }] }]
  }
  const groups: NavGroup[] = [
    { title: 'Studio', items: [{ href: '/', label: 'Acasă', icon: 'home' }] },
    {
      title: 'Oameni',
      items: [
        { href: '/modele', label: 'Modele', icon: 'models' },
        ...(can(role, 'team:write') ? [{ href: '/echipa', label: 'Echipă', icon: 'team' } as const] : []),
      ],
    },
    { title: 'Timp', items: [{ href: '/orar', label: 'Orar camere', icon: 'calendar' }] },
  ]
  if (can(role, 'earnings:read')) {
    groups.push({
      title: 'Bani',
      items: [
        { href: '/incasari', label: 'Încasări', icon: 'money' },
        { href: '/plati', label: 'Plăți', icon: 'payroll' },
      ],
    })
  }
  if (can(role, 'settings:write')) {
    groups.push({
      title: 'Administrare',
      items: [
        { href: '/setari', label: 'Setări', icon: 'settings' },
        { href: '/audit', label: 'Jurnal de audit', icon: 'audit' },
      ],
    })
  }
  return groups
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const { studioName } = await getSettings()
  return (
    <div className="min-h-dvh lg:flex">
      <AppNav groups={navFor(user.role)} studioName={studioName} userName={user.name} roleLabel={ROLE_LABEL[user.role]} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8 print:p-0">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  )
}
