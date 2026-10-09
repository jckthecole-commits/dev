'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { quickSearch, type SearchHit } from '@/app/actions/search'
import { FrameArt } from '@/components/frame-art'
import { Icon } from '@/components/icons'
import { formatPrice } from '@/lib/format'

const SUGGESTIONS = ['rotunde', 'titan', 'cat-eye', 'polarizat', 'havana', 'progresive']

export function SearchButton() {
  const ref = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const [q, setQ] = useState('')
  const [res, setRes] = useState<{ products: SearchHit[]; articles: { slug: string; title: string }[] }>({ products: [], articles: [] })
  const [pending, start] = useTransition()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement))) {
        e.preventDefault()
        ref.current?.showModal()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) return
    const t = setTimeout(() => start(async () => setRes(await quickSearch(term))), 160)
    return () => clearTimeout(t)
  }, [q])

  const close = () => ref.current?.close()
  const shown = q.trim().length >= 2 ? res : { products: [], articles: [] }

  return (
    <>
      <button type="button" aria-label="Caută (Ctrl+K)" onClick={() => { ref.current?.showModal(); inputRef.current?.focus() }} className="inline-flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/[.07]">
        <Icon name="search" />
      </button>
      <dialog
        ref={ref}
        aria-label="Căutare"
        className="mx-auto mt-[8vh] w-[min(720px,calc(100%-24px))] rounded-[24px] bg-glass p-0 shadow-[var(--shadow-lift)]"
        onClick={(e) => { if (e.target === ref.current) close() }}
      >
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            if (!q.trim()) return
            close()
            router.push(`/cautare?q=${encodeURIComponent(q.trim())}`)
          }}
          className="flex items-center gap-3 border-b border-line px-5"
        >
          <Icon name="search" className="shrink-0 text-graphite" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Caută o ramă, o formă, un cod de model…"
            aria-label="Termen de căutare"
            className="h-16 w-full bg-transparent text-[18px] outline-none placeholder:text-mist"
            autoComplete="off"
            enterKeyHint="search"
          />
          {pending ? <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-line border-t-cobalt" aria-hidden /> : null}
          <button type="button" onClick={close} className="eyebrow shrink-0 rounded-md px-2 py-1 hover:bg-fog">
            Esc
          </button>
        </form>
        <div className="max-h-[60vh] overflow-y-auto p-3">
          {shown.products.length === 0 && shown.articles.length === 0 ? (
            <div className="p-3">
              <div className="eyebrow mb-3">{q.trim().length >= 2 && !pending ? 'Niciun rezultat. Încearcă:' : 'Căutări frecvente'}</div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => setQ(s)} className="rounded-full bg-fog px-3.5 py-2 text-sm hover:bg-line-soft">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {shown.products.length ? (
            <ul className="grid gap-1 sm:grid-cols-2">
              {shown.products.map((p) => (
                <li key={p.slug}>
                  <Link href={`/rame/${p.slug}`} onClick={close} className="flex items-center gap-4 rounded-2xl p-3 no-underline hover:bg-fog">
                    <span className="grid h-14 w-24 shrink-0 place-items-center rounded-xl bg-fog">
                      <FrameArt product={p.art} swatch={p.swatch} className="h-9 w-auto" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-bold">{p.name}</span>
                      <span className="spec block truncate">{p.spec}</span>
                      <span className="block text-sm">{formatPrice(p.price)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {shown.articles.length ? (
            <div className="mt-2 border-t border-line p-3">
              <div className="eyebrow mb-2">Ghiduri</div>
              {shown.articles.map((a) => (
                <Link key={a.slug} href={`/jurnal/${a.slug}`} onClick={close} className="flex items-center gap-2 py-1.5 no-underline hover:text-cobalt">
                  <Icon name="file" size={18} /> {a.title}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </dialog>
    </>
  )
}
