'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon, type IconName } from '@/components/icons'
import { cn } from '@/lib/cn'

export type NavItem = { href: string; label: string; icon: IconName; badge?: number }
export type NavGroup = { title: string; items: NavItem[] }

/** Active state needs the runtime pathname, so the layout streams this in behind <Suspense>. */
export function AdminNav({ groups }: { groups: NavGroup[] }) {
  return <AdminNavList groups={groups} pathname={usePathname()} />
}

/** Hook-free list — used as the prerendered fallback (no active item yet). */
export function AdminNavList({ groups, pathname }: { groups: NavGroup[]; pathname: string | null }) {
  return (
    <nav aria-label="Administrare" className="flex flex-col gap-6">
      {groups.map((g) => (
        <div key={g.title}>
          <div className="eyebrow mb-2 px-3 text-[10.5px]">{g.title}</div>
          <ul className="flex flex-col gap-0.5">
            {g.items.map((it) => {
              const active = pathname !== null && (it.href === '/admin' ? pathname === '/admin' : pathname.startsWith(it.href))
              return (
                <li key={it.href}>
                  <Link href={it.href} aria-current={active ? 'page' : undefined} className={cn('flex items-center gap-3 rounded-xl px-3 py-2 text-[14.5px] no-underline transition-colors', active ? 'bg-cobalt-50 font-bold text-cobalt' : 'text-ink-2 hover:bg-paper')}>
                    <Icon name={it.icon} size={19} />
                    <span className="flex-1">{it.label}</span>
                    {it.badge ? <span className="rounded-full bg-cobalt px-1.5 font-mono text-[11px] leading-5 text-white">{it.badge}</span> : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
