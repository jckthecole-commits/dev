import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArticleBody } from '@/components/content/article-body'
import { JsonLd } from '@/components/seo/json-ld'
import { formatDate } from '@/lib/format'
import { breadcrumbLd } from '@/lib/seo'
import { getPost, getPublishedPosts } from '@/server/content'

/** CMS pages (legal, shipping, returns…) at top-level slugs, editable in /admin/continut. */
export async function generateStaticParams() {
  try {
    const pages = await getPublishedPosts('page')
    return pages.length ? pages.map((p) => ({ page: p.slug })) : [{ page: '__none__' }]
  } catch {
    return [{ page: '__none__' }]
  }
}

export async function generateMetadata({ params }: PageProps<'/[page]'>): Promise<Metadata> {
  const p = await getPost((await params).page, 'page')
  if (!p) return {}
  return { title: p.metaTitle ?? p.title, description: p.metaDescription ?? p.excerpt ?? undefined, alternates: { canonical: `/${p.slug}` } }
}

export default async function CmsPage({ params }: PageProps<'/[page]'>) {
  const p = await getPost((await params).page, 'page')
  if (!p) notFound()
  return (
    <article className="container-x pb-10 pt-12">
      <JsonLd data={breadcrumbLd([{ name: 'Acasă', path: '/' }, { name: p.title, path: `/${p.slug}` }])} />
      <div className="mx-auto max-w-3xl">
        <div className="eyebrow">Informații · actualizat {formatDate(p.updatedAt)}</div>
        <h1 className="disp mt-3 text-[clamp(40px,5.6vw,76px)]">{p.title}</h1>
        {p.excerpt ? <p className="mt-4 text-[19px] text-ink-2">{p.excerpt}</p> : null}
        <div className="mt-10">
          <ArticleBody markdown={p.body} />
        </div>
      </div>
    </article>
  )
}
