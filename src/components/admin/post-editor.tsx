'use client'

import { useDeferredValue, useState } from 'react'
import type { FormResult } from '@/components/admin/form'
import { cn } from '@/lib/cn'
import { renderMarkdown } from '@/lib/markdown'
import { slugify } from '@/lib/text'
import { useActionForm } from '@/lib/use-action-form'

export type PostDraft = { kind: 'article' | 'page'; title: string; slug: string; excerpt: string; body: string; category: string; authorName: string; status: 'draft' | 'published'; metaTitle: string; metaDescription: string; coverUrl: string | null }

const TOOLS: [string, string, string][] = [
  ['H2', '\n## ', ''],
  ['H3', '\n### ', ''],
  ['B', '**', '**'],
  ['I', '_', '_'],
  ['Link', '[', '](https://)'],
  ['Listă', '\n- ', ''],
  ['Citat', '\n> ', ''],
]
const field = 'field h-11 text-[14.5px]'

export function PostEditor({ initial, action, isNew, categories }: { initial: PostDraft; action: (s: FormResult, fd: FormData) => Promise<FormResult>; isNew: boolean; categories: string[] }) {
  const [d, setD] = useState(initial)
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [state, onSubmit, pending] = useActionForm(action, null)
  const body = useDeferredValue(d.body)
  const set = <K extends keyof PostDraft>(k: K, v: PostDraft[K]) => setD((p) => ({ ...p, [k]: v }))
  const err = (k: string) => state?.fieldErrors?.[k]
  const words = d.body.split(/\s+/).filter(Boolean).length
  const autoSlug = slugify(d.title)
  const path = d.kind === 'article' ? `/jurnal/${d.slug || autoSlug}` : `/${d.slug || autoSlug}`

  const wrap = (before: string, after: string) => {
    const ta = document.getElementById('post-body') as HTMLTextAreaElement | null
    if (!ta) return
    const { selectionStart: a, selectionEnd: b, value } = ta
    const next = value.slice(0, a) + before + value.slice(a, b) + after + value.slice(b)
    set('body', next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(a + before.length, b + before.length)
    })
  }

  return (
    <form onSubmit={onSubmit} className="pb-28">
      <input type="hidden" name="kind" value={d.kind} />
      <input type="hidden" name="status" value={d.status} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <input name="title" value={d.title} onChange={(e) => set('title', e.target.value)} placeholder="Titlu" aria-label="Titlu" className="w-full border-0 bg-transparent font-display text-[clamp(28px,3vw,40px)] font-bold leading-tight tracking-[-0.02em] outline-none placeholder:text-mist" />
          {err('title') ? <p className="-mt-2 text-[13px] text-err">{err('title')}</p> : null}
          <div className="overflow-hidden rounded-[20px] bg-glass ring-1 ring-line-soft">
            <div className="flex flex-wrap items-center gap-1 border-b border-line-soft px-3 py-2">
              {(['edit', 'preview'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)} aria-pressed={tab === t} className={cn('rounded-full px-3 py-1 text-[13px]', tab === t ? 'bg-ink font-bold text-fog' : 'hover:bg-paper')}>{t === 'edit' ? 'Scrie' : 'Previzualizare'}</button>
              ))}
              <span className="mx-2 h-5 w-px bg-line" />
              {TOOLS.map(([l, a, b]) => <button key={l} type="button" onClick={() => wrap(a, b)} disabled={tab !== 'edit'} className="rounded-lg px-2 py-1 font-mono text-[12.5px] hover:bg-paper disabled:opacity-40">{l}</button>)}
              <span className="ml-auto font-mono text-[12px] text-graphite">{words} cuvinte · ~{Math.max(1, Math.round(words / 200))} min</span>
            </div>
            <div className="grid lg:grid-cols-2">
              <textarea id="post-body" name="body" value={d.body} onChange={(e) => set('body', e.target.value)} rows={28} spellCheck lang="ro" className={cn('min-h-[560px] w-full resize-y bg-paper p-5 font-mono text-[13.5px] leading-relaxed outline-none', tab === 'preview' && 'hidden lg:block')} aria-label="Conținut (Markdown)" />
              <article className={cn('prose-sv max-h-[720px] overflow-y-auto border-l border-line-soft p-6', tab === 'edit' && 'hidden lg:block')} dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />
            </div>
          </div>
          {err('body') ? <p className="text-[13px] text-err">{err('body')}</p> : null}
          <p className="text-[12.5px] text-graphite">Markdown: ## titlu, **bold**, [link](/rame-de-vedere), liste cu „- ”. În pagini poți folosi variabile din setări, ex. {'{{company.cui}}'}, {'{{company.phone}}'}, {'{{policies.returnDays}}'}.</p>
        </div>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
          <div className="rounded-[20px] bg-glass p-5 ring-1 ring-line-soft">
            <div className="flex rounded-full bg-fog p-1 ring-1 ring-line-soft">
              {(['draft', 'published'] as const).map((s) => (
                <button key={s} type="button" onClick={() => set('status', s)} aria-pressed={d.status === s} className={cn('h-9 flex-1 rounded-full text-[13.5px]', d.status === s ? 'bg-ink font-bold text-fog' : '')}>{s === 'draft' ? 'Ciornă' : 'Publicat'}</button>
              ))}
            </div>
            {isNew ? (
              <label className="mt-4 flex flex-col gap-1.5"><span className="text-[13px] font-bold">Tip</span>
                <select value={d.kind} onChange={(e) => set('kind', e.target.value as PostDraft['kind'])} className={field}><option value="article">Articol (jurnal / ghid)</option><option value="page">Pagină (informații, legal)</option></select>
              </label>
            ) : null}
            <label className="mt-4 flex flex-col gap-1.5"><span className="text-[13px] font-bold">Adresă</span>
              <input name="slug" value={d.slug} onChange={(e) => set('slug', slugify(e.target.value))} placeholder={autoSlug} className={field} />
              <span className={cn('truncate text-[12.5px]', err('slug') ? 'text-err' : 'text-graphite')}>{err('slug') ?? path}</span>
            </label>
            {d.kind === 'article' ? (
              <>
                <label className="mt-4 flex flex-col gap-1.5"><span className="text-[13px] font-bold">Categorie</span>
                  <input name="category" value={d.category} onChange={(e) => set('category', e.target.value)} list="post-categories" className={field} />
                  <datalist id="post-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
                </label>
                <label className="mt-4 flex flex-col gap-1.5"><span className="text-[13px] font-bold">Autor</span><input name="authorName" value={d.authorName} onChange={(e) => set('authorName', e.target.value)} className={field} /></label>
              </>
            ) : null}
            <label className="mt-4 flex flex-col gap-1.5"><span className="text-[13px] font-bold">Rezumat</span>
              <textarea name="excerpt" value={d.excerpt} onChange={(e) => set('excerpt', e.target.value)} rows={3} maxLength={300} className="field h-auto py-2.5 text-[14px]" />
            </label>
            <label className="mt-4 flex flex-col gap-1.5"><span className="text-[13px] font-bold">Imagine de copertă</span>
              {d.coverUrl ? (
                <span className="flex items-center gap-3">
                                    <img src={d.coverUrl} alt="" className="h-14 w-20 rounded-lg object-cover ring-1 ring-line-soft" />
                  <label className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" name="removeCover" className="accent-cobalt" /> elimină</label>
                </span>
              ) : null}
              <input type="file" name="cover" accept="image/jpeg,image/png,image/webp,image/avif" className="text-[13px] file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-[12.5px] file:font-bold file:text-fog" />
            </label>
          </div>
          <details className="rounded-[20px] bg-glass p-5 ring-1 ring-line-soft">
            <summary className="cursor-pointer text-[14px] font-bold">Google & rețele</summary>
            <label className="mt-4 flex flex-col gap-1.5"><span className="text-[13px] font-bold">Titlu SEO</span><input name="metaTitle" value={d.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} placeholder={d.title} className={field} /></label>
            <label className="mt-3 flex flex-col gap-1.5"><span className="text-[13px] font-bold">Descriere SEO</span><textarea name="metaDescription" value={d.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} placeholder={d.excerpt} rows={3} className="field h-auto py-2.5 text-[14px]" /></label>
            <div className="mt-3 rounded-xl bg-paper p-3 ring-1 ring-line-soft">
              <div className="truncate text-[12px] text-graphite">sifravision.ro{path.replaceAll('/', ' › ')}</div>
              <div className="line-clamp-1 text-[16px] text-[#1a0dab]">{d.metaTitle || d.title || 'Titlu'}</div>
              <div className="line-clamp-2 text-[12.5px]">{d.metaDescription || d.excerpt}</div>
            </div>
          </details>
        </aside>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-glass/90 backdrop-blur lg:left-[256px]">
        <div className="flex items-center gap-4 px-5 py-3 lg:px-10">
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? 'Se salvează…' : d.status === 'published' ? 'Publică' : 'Salvează ciorna'}</button>
          {state ? <span role="status" className={cn('text-[14px]', state.ok ? 'text-ok' : 'text-err')}>{state.ok ? state.message : state.error}</span> : null}
          {!isNew && d.status === 'published' ? <a href={path} target="_blank" className="ml-auto text-[13.5px] font-bold text-cobalt">Vezi pe site ↗</a> : null}
        </div>
      </div>
    </form>
  )
}
