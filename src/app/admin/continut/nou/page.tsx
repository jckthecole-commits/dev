import { isNotNull } from 'drizzle-orm'
import { Suspense } from 'react'
import { savePost } from '@/app/admin/_actions/content'
import { PostEditor } from '@/components/admin/post-editor'
import { PageHeader } from '@/components/admin/ui'
import { db } from '@/lib/db'
import { post } from '@/lib/db/schema'
import { requireStaff } from '@/server/session'

export const metadata = { title: 'Conținut nou' }

export default function NewPost({ searchParams }: Pick<PageProps<'/admin/continut/nou'>, 'searchParams'>) {
  return (
    <Suspense fallback={<div className="skeleton h-[700px]" />}>
      <Editor searchParams={searchParams} />
    </Suspense>
  )
}

async function Editor({ searchParams }: Pick<PageProps<'/admin/continut/nou'>, 'searchParams'>) {
  const me = await requireStaff('content:write')
  const sp = await searchParams
  const kind = sp.tip === 'page' ? 'page' : 'article'
  const cats = await db.selectDistinct({ c: post.category }).from(post).where(isNotNull(post.category))
  return (
    <>
      <PageHeader eyebrow="Conținut" title={kind === 'page' ? 'Pagină nouă' : 'Articol nou'} />
      <PostEditor isNew action={savePost.bind(null, null)} categories={cats.map((c) => c.c!)} initial={{ kind, title: '', slug: '', excerpt: '', body: '', category: '', authorName: kind === 'article' ? me.name : '', status: 'draft', metaTitle: '', metaDescription: '', coverUrl: null }} />
    </>
  )
}
