import type { Metadata } from 'next'
import Link from 'next/link'
import { formatDate } from '@/lib/format'
import { getPublishedPosts } from '@/server/content'

export const metadata: Metadata = {
  title: 'Jurnal — ghiduri despre ochelari, lentile și vedere',
  description: 'Ghiduri practice scrise de optometriști: cum citești rețeta, cum alegi mărimea ramei, lentile progresive, indicele de refracție, ochelari de soare.',
  alternates: { canonical: '/jurnal' },
}

export default async function JournalPage() {
  const posts = await getPublishedPosts('article')
  const [lead, ...rest] = posts
  return (
    <div className="container-x pb-10 pt-12">
      <div className="eyebrow">Jurnal</div>
      <h1 className="disp mt-3 text-[clamp(44px,6vw,96px)]">Ghiduri, fără jargon.</h1>
      {lead ? (
        <Link href={`/jurnal/${lead.slug}`} className="group card mt-12 grid overflow-hidden no-underline md:grid-cols-2">
          <div className="grid aspect-[16/10] place-items-center bg-[linear-gradient(160deg,#FFFFFF,#E7ECEA)] md:aspect-auto">
            <span className="chart-row text-[clamp(56px,9vw,130px)] text-ink/85 blur-[6px] transition-[filter] duration-500 group-hover:blur-0">Rx</span>
          </div>
          <div className="flex flex-col justify-center p-8 md:p-12">
            <div className="spec">{lead.category} · {lead.readingMinutes} min · {lead.publishedAt ? formatDate(lead.publishedAt) : ''}</div>
            <h2 className="disp mt-3 text-[clamp(30px,3.4vw,48px)]">{lead.title}</h2>
            <p className="mt-3 text-[16px] text-ink-2">{lead.excerpt}</p>
          </div>
        </Link>
      ) : null}
      <ul className="mt-6 grid gap-5 md:grid-cols-3">
        {rest.map((p, i) => (
          <li key={p.slug}>
            <Link href={`/jurnal/${p.slug}`} className="group card flex h-full flex-col overflow-hidden no-underline">
              <div className="grid aspect-[16/10] place-items-center bg-[linear-gradient(160deg,#FFFFFF,#E7ECEA)]">
                <span className="chart-row text-[64px] text-ink/85 blur-[5px] transition-[filter] duration-500 group-hover:blur-0">{['A□B', 'ADD', '1.67', 'UV', 'PD'][i % 5]}</span>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <div className="spec">{p.category} · {p.readingMinutes} min</div>
                <h2 className="mt-2 text-[19px] font-bold leading-snug">{p.title}</h2>
                <p className="mt-2 text-[14.5px] text-graphite">{p.excerpt}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
