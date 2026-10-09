import type { Metadata } from 'next'
import { sql } from 'drizzle-orm'
import Link from 'next/link'
import { Suspense } from 'react'
import { AdminNav, AdminNavList, type NavGroup } from '@/components/admin/nav'
import { Wordmark } from '@/components/brand'
import { Icon } from '@/components/icons'
import { db } from '@/lib/db'
import { inquiry, order, partner, prescription, review } from '@/lib/db/schema'
import { getCurrentUser } from '@/server/session'

export const metadata: Metadata = { title: { default: 'Administrare', template: '%s · Admin Sifra Vision' }, robots: { index: false, follow: false } }

const GROUPS: NavGroup[] = [
  { title: 'Operațiuni', items: [
    { href: '/admin', label: 'Panou', icon: 'grid' },
    { href: '/admin/comenzi', label: 'Comenzi', icon: 'bag' },
    { href: '/admin/retete', label: 'Rețete', icon: 'rx' },
    { href: '/admin/programari', label: 'Programări', icon: 'calendar' },
    { href: '/admin/mesaje', label: 'Mesaje', icon: 'inbox' },
  ] },
  { title: 'Catalog', items: [
    { href: '/admin/produse', label: 'Produse & stoc', icon: 'glasses' },
    { href: '/admin/lentile', label: 'Lentile & prețuri', icon: 'layers' },
    { href: '/admin/cupoane', label: 'Cupoane', icon: 'tag' },
    { href: '/admin/recenzii', label: 'Recenzii', icon: 'star' },
  ] },
  { title: 'Clienți', items: [
    { href: '/admin/clienti', label: 'Clienți', icon: 'users' },
    { href: '/admin/parteneri', label: 'Parteneri B2B', icon: 'building' },
  ] },
  { title: 'Conținut & setări', items: [
    { href: '/admin/continut', label: 'Pagini & jurnal', icon: 'file' },
    { href: '/admin/setari', label: 'Setări magazin', icon: 'settings' },
    { href: '/admin/integrari', label: 'Lansare & integrări', icon: 'shield' },
    { href: '/admin/utilizatori', label: 'Echipă & roluri', icon: 'lock' },
    { href: '/admin/audit', label: 'Jurnal de audit', icon: 'list' },
  ] },
]

async function NavWithBadges() {
  const user = await getCurrentUser()
  if (!user) return <AdminNav groups={GROUPS} />
  const [counts] = await db.execute<{ orders: number; rx: number; partners: number; inbox: number; reviews: number }>(sql`
    select
      (select count(*) from ${order} where ${order.status} in ('placed','rx_review','on_hold'))::int as orders,
      (select count(*) from ${prescription} where ${prescription.status} = 'pending')::int as rx,
      (select count(*) from ${partner} where ${partner.status} = 'pending')::int as partners,
      (select count(*) from ${inquiry} where ${inquiry.status} = 'new')::int as inbox,
      (select count(*) from ${review} where ${review.status} = 'pending')::int as reviews`)
  const badge: Record<string, number> = { '/admin/comenzi': counts?.orders ?? 0, '/admin/retete': counts?.rx ?? 0, '/admin/parteneri': counts?.partners ?? 0, '/admin/mesaje': counts?.inbox ?? 0, '/admin/recenzii': counts?.reviews ?? 0 }
  return <AdminNav groups={GROUPS.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i, badge: badge[i.href] })) }))} />
}

async function UserChip() {
  const u = await getCurrentUser()
  if (!u) return null
  return (
    <span className="flex items-center gap-2 text-[13.5px]">
      <span className="grid size-8 place-items-center rounded-full bg-ink font-mono text-[12px] text-fog">{u.name.slice(0, 1).toUpperCase()}</span>
      <span className="hidden sm:inline">
        {u.name} <span className="text-graphite">· {u.role}</span>
      </span>
    </span>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-fog lg:grid lg:grid-cols-[256px_1fr] print:block print:bg-white">
      <aside className="sticky top-0 hidden h-dvh print:!hidden flex-col gap-7 overflow-y-auto border-r border-line bg-glass px-3 py-5 lg:flex">
        <div className="flex items-center gap-2 px-3">
          <Wordmark size={14} href="/admin" label="Panou de administrare" />
        </div>
        <Suspense fallback={<AdminNavList groups={GROUPS} pathname={null} />}>
          <NavWithBadges />
        </Suspense>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 print:hidden items-center justify-between gap-4 border-b border-line bg-fog/85 px-5 backdrop-blur lg:px-10">
          <details className="relative lg:hidden">
            <summary className="flex items-center gap-2 text-[14px] font-bold">
              <Icon name="menu" /> Meniu
            </summary>
            <div className="absolute left-0 top-10 z-30 max-h-[80vh] w-64 overflow-y-auto rounded-2xl bg-glass p-3 shadow-[var(--shadow-lift)] ring-1 ring-line">
              <Suspense fallback={<AdminNavList groups={GROUPS} pathname={null} />}>
                <AdminNav groups={GROUPS} />
              </Suspense>
            </div>
          </details>
          <span className="eyebrow hidden lg:inline">Sifra Vision · administrare</span>
          <div className="flex items-center gap-4">
            <Link href="/" target="_blank" className="flex items-center gap-1.5 text-[13.5px] text-graphite no-underline hover:text-ink">
              <Icon name="external" size={16} /> Vezi site-ul
            </Link>
            <Suspense fallback={<span className="size-8 rounded-full bg-line-soft" />}>
              <UserChip />
            </Suspense>
          </div>
        </header>
        <main id="continut" className="px-5 py-8 lg:px-10 print:p-0">
          {children}
        </main>
      </div>
    </div>
  )
}

