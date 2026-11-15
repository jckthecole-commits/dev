'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { Icon, type IconName } from './icons'
import { cn } from './ui'

export type NavItem = { href: string; label: string; icon: IconName }
export type NavGroup = { title: string; items: NavItem[] }

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

function NavList({ groups, pathname, onNavigate }: { groups: NavGroup[]; pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.title}>
          <div className="mb-1 px-3 text-xs font-medium text-muted">{g.title}</div>
          <ul>
            {g.items.map((i) => {
              const active = isActive(pathname, i.href)
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition', active ? 'bg-accent text-accent-ink' : 'text-text hover:bg-panel-2')}
                  >
                    <Icon name={i.icon} />
                    {i.label}
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

function SignOut() {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut()
        router.replace('/autentificare')
        router.refresh()
      }}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-panel-2 hover:text-text"
    >
      <Icon name="logout" />
      Ieșire
    </button>
  )
}

export function AppNav({ groups, studioName, userName, roleLabel }: { groups: NavGroup[]; studioName: string; userName: string; roleLabel: string }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
  }, [open])

  const brand = (
    <div className="px-3">
      <div className="truncate text-lg font-semibold tracking-tight">{studioName}</div>
      <div className="text-xs text-muted">Studio ERP</div>
    </div>
  )
  const footer = (
    <div className="mt-auto border-t border-line pt-3">
      <Link href="/cont" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-panel-2">
        <Icon name="user" />
        <span className="min-w-0">
          <span className="block truncate">{userName}</span>
          <span className="block text-xs text-muted">{roleLabel}</span>
        </span>
      </Link>
      <SignOut />
    </div>
  )

  return (
    <>
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-line bg-panel px-3 py-5 lg:flex print:hidden">
        {brand}
        <NavList groups={groups} pathname={pathname} />
        {footer}
      </aside>

      {/* phone / tablet top bar + drawer */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-panel/95 px-4 backdrop-blur lg:hidden print:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label="Deschide meniul" aria-expanded={open} className="-ml-2 rounded-lg p-2 hover:bg-panel-2">
          <Icon name="menu" className="size-6" />
        </button>
        <span className="truncate font-semibold">{studioName}</span>
        <span className="w-10" />
      </header>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Meniu">
          <button type="button" aria-label="Închide meniul" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col gap-6 overflow-y-auto bg-panel px-3 py-4 shadow-2xl">
            <div className="flex items-start justify-between">
              {brand}
              <button type="button" onClick={() => setOpen(false)} aria-label="Închide meniul" className="rounded-lg p-2 hover:bg-panel-2">
                <Icon name="close" />
              </button>
            </div>
            <NavList groups={groups} pathname={pathname} onNavigate={() => setOpen(false)} />
            {footer}
          </div>
        </div>
      ) : null}
    </>
  )
}
