'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Wordmark } from '@/components/brand'
import { Icon } from '@/components/icons'

export function MobileMenu({ nav }: { nav: { href: string; label: string }[] }) {
  const ref = useRef<HTMLDialogElement>(null)
  // the menu's content only exists while it is open — every page ships a lighter header
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal()
  }, [open])

  return (
    <>
      <button type="button" aria-label="Deschide meniul" onClick={() => setOpen(true)} className="-ml-2 inline-flex size-11 items-center justify-center rounded-full hover:bg-ink/[.07] lg:hidden">
        <Icon name="menu" />
      </button>
      <dialog
        ref={ref}
        aria-label="Meniu"
        className="m-0 h-dvh max-h-none w-full max-w-none bg-fog p-0 backdrop:bg-ink/40 open:animate-[fadeup_.35s_var(--ease-out-expo)]"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          // backdrop click or any link inside → close (no pathname subscription, so the header stays static)
          if (e.target === ref.current || (e.target as Element).closest('a')) ref.current?.close()
        }}
      >
        {open ? (
          <div className="flex h-full flex-col px-5 pb-8 pt-3">
            <div className="flex h-14 items-center justify-between">
              <Wordmark size={17} />
              <button type="button" aria-label="Închide meniul" onClick={() => ref.current?.close()} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-ink/[.07]">
                <Icon name="close" />
              </button>
            </div>
            <nav aria-label="Meniu mobil" className="mt-6 flex flex-col">
              {nav.map((item, i) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="disp flex items-center justify-between border-b border-line py-4 text-[30px] no-underline"
                  style={{ animation: `focus-in-soft .6s var(--ease-out-expo) ${0.05 + i * 0.05}s both` }}
                >
                  {item.label}
                  <Icon name="arrow-right" size={22} />
                </Link>
              ))}
            </nav>
            <div className="mt-8 grid grid-cols-2 gap-3 text-[15px]">
              <Link href="/cont" className="flex items-center gap-2 no-underline">
                <Icon name="user" size={20} /> Contul meu
              </Link>
              <Link href="/favorite" className="flex items-center gap-2 no-underline">
                <Icon name="heart" size={20} /> Favorite
              </Link>
              <Link href="/b2b" className="flex items-center gap-2 no-underline">
                <Icon name="building" size={20} /> Pentru optici
              </Link>
              <Link href="/jurnal" className="flex items-center gap-2 no-underline">
                <Icon name="file" size={20} /> Ghiduri
              </Link>
            </div>
            <div className="mt-auto flex flex-col gap-3">
              <Link href="/proba-virtuala" className="btn btn-primary w-full">
                <Icon name="camera" size={20} /> Probează virtual
              </Link>
              <Link href="/programare" className="btn btn-secondary w-full">
                Programează-te în showroom
              </Link>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  )
}
