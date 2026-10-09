import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArticleBody } from '@/components/content/article-body'
import { Icon } from '@/components/icons'
import { JsonLd } from '@/components/seo/json-ld'
import { formatDate } from '@/lib/format'
import { headingsOf } from '@/lib/markdown'
import { articleLd, breadcrumbLd } from '@/lib/seo'
import { getPost, getPublishedPosts } from '@/server/content'

export async function generateStaticParams() {
  try {
    const posts = await getPublishedPosts('article')
    return posts.length ? posts.map((p) => ({ slug: p.slug })) : [{ slug: '__none__' }]
  } catch {
    return [{ slug: '__none__' }]
  }
}

export async function generateMetadata({ params }: PageProps<'/jurnal/[slug]'>): Promise<Metadata> {
  const p = await getPost((await params).slug, 'article')
  if (!p) return {}
  return {
    title: p.metaTitle ?? p.title,
    description: p.metaDescription ?? p.excerpt ?? undefined,
    alternates: { canonical: `/jurnal/${p.slug}` },
    openGraph: { type: 'article', title: p.title, description: p.excerpt ?? undefined, publishedTime: p.publishedAt?.toISOString(), modifiedTime: p.updatedAt.toISOString() },
  }
}

export default async function ArticlePage({ params }: Pick<PageProps<'/jurnal/[slug]'>, 'params'>) {
  const p = await getPost((await params).slug, 'article')
  if (!p) notFound()
  const toc = headingsOf(p.body)
  const others = (await getPublishedPosts('article')).filter((x) => x.slug !== p.slug).slice(0, 3)
  return (
    <article className="container-x pb-10 pt-12">
      <JsonLd data={[articleLd(p), breadcrumbLd([{ name: 'Acasă', path: '/' }, { name: 'Jurnal', path: '/jurnal' }, { name: p.title, path: `/jurnal/${p.slug}` }])]} />
      <Link href="/jurnal" className="spec inline-flex items-center gap-1 no-underline hover:text-ink">
        <Icon name="arrow-left" size={14} /> Jurnal
      </Link>
      <header className="mx-auto mt-6 max-w-4xl">
        <div className="spec">{p.category} · {p.readingMinutes} min de citit · {p.publishedAt ? formatDate(p.publishedAt) : ''}</div>
        <h1 className="disp mt-4 text-[clamp(40px,5.6vw,80px)]">{p.title}</h1>
        {p.excerpt ? <p className="mt-5 text-[20px] leading-relaxed text-ink-2">{p.excerpt}</p> : null}
      </header>
      <div className="mx-auto mt-14 grid max-w-6xl gap-12 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          {toc.length ? (
            <nav aria-label="Cuprins" className="sticky top-28">
              <div className="eyebrow mb-3">Cuprins</div>
              <ol className="flex flex-col gap-2 text-[14px]">
                {toc.map((h) => (
                  <li key={h.id}><a href={`#${h.id}`} className="text-graphite no-underline hover:text-ink">{h.text}</a></li>
                ))}
              </ol>
            </nav>
          ) : null}
        </aside>
        <div className="max-w-[68ch]">
          <ArticleBody markdown={p.body} />
          <div className="mt-14 rounded-[24px] bg-ink p-8 text-fog">
            <h2 className="disp text-[30px]">Ai o întrebare pentru optometrist?</h2>
            <p className="mt-2 text-fog/75">Programează o consultație în showroom-ul din Galați sau scrie-ne.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/programare" className="btn btn-primary">Programează-te</Link>
              <Link href="/contact" className="btn bg-fog text-ink hover:bg-white">Scrie-ne</Link>
            </div>
          </div>
        </div>
      </div>
      {others.length ? (
        <section className="mx-auto mt-20 max-w-6xl">
          <h2 className="eyebrow mb-4">Citește și</h2>
          <ul className="grid gap-4 md:grid-cols-3">
            {others.map((o) => (
              <li key={o.slug}><Link href={`/jurnal/${o.slug}`} className="card block h-full p-6 no-underline hover:shadow-[var(--shadow-lift)]"><div className="spec">{o.category}</div><div className="mt-2 text-[17px] font-bold leading-snug">{o.title}</div></Link></li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  )
}
