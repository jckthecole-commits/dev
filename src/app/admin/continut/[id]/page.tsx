import { eq, isNotNull } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { deletePost, savePost } from '@/app/admin/_actions/content'
import { ActionButton } from '@/components/admin/action-button'
import { PostEditor } from '@/components/admin/post-editor'
import { PageHeader } from '@/components/admin/ui'
import { Icon } from '@/components/icons'
import { db } from '@/lib/db'
import { post } from '@/lib/db/schema'
import { formatDateTime } from '@/lib/format'
import { requireStaff } from '@/server/session'
import { publicUrl } from '@/server/storage'

export const metadata = { title: 'Editează conținut' }

export default function EditPost({ params }: Pick<PageProps<'/admin/continut/[id]'>, 'params'>) {
  return (
    <Suspense fallback={<div className="skeleton h-[700px]" />}>
      <Editor params={params} />
    </Suspense>
  )
}

async function Editor({ params }: Pick<PageProps<'/admin/continut/[id]'>, 'params'>) {
  await requireStaff('content:write')
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const p = await db.query.post.findFirst({ where: eq(post.id, id) })
  if (!p) notFound()
  const cats = await db.selectDistinct({ c: post.category }).from(post).where(isNotNull(post.category))
  return (
    <>
      <PageHeader eyebrow={`${p.kind === 'page' ? 'Pagină' : 'Articol'} · actualizat ${formatDateTime(p.updatedAt)}`} title={p.title} actions={<ActionButton action={deletePost.bind(null, p.id)} variant="ghost" confirm="Ștergi definitiv? Linkurile către această adresă vor da 404."><Icon name="trash" size={15} /> Șterge</ActionButton>} />
      <PostEditor
        isNew={false}
        action={savePost.bind(null, p.id)}
        categories={cats.map((c) => c.c!)}
        initial={{ kind: p.kind as 'article' | 'page', title: p.title, slug: p.slug, excerpt: p.excerpt ?? '', body: p.body, category: p.category ?? '', authorName: p.authorName ?? '', status: p.status, metaTitle: p.metaTitle ?? '', metaDescription: p.metaDescription ?? '', coverUrl: p.coverKey ? publicUrl(p.coverKey) : null }}
      />
    </>
  )
}
