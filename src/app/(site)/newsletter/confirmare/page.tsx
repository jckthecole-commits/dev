import type { Metadata } from 'next'
import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { Suspense } from 'react'
import { db } from '@/lib/db'
import { subscriber } from '@/lib/db/schema'

export const metadata: Metadata = { title: 'Confirmare abonare', robots: { index: false } }

export default function ConfirmPage({ searchParams }: PageProps<'/newsletter/confirmare'>) {
  return (
    <div className="container-x grid min-h-[50vh] place-items-center py-16 text-center">
      <Suspense fallback={<div className="skeleton h-40 w-96" />}>
        <Confirm searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function Confirm({ searchParams }: PageProps<'/newsletter/confirmare'>) {
  const t = (await searchParams).t
  const token = typeof t === 'string' ? t : ''
  const row = token ? await db.query.subscriber.findFirst({ where: eq(subscriber.confirmToken, token) }) : null
  if (row) await db.update(subscriber).set({ confirmedAt: new Date(), confirmToken: null }).where(eq(subscriber.id, row.id))
  return (
    <div>
      <h1 className="disp text-[clamp(40px,5vw,72px)]">{row ? 'Abonare confirmată.' : 'Link expirat.'}</h1>
      <p className="mt-3 text-ink-2">{row ? 'Mulțumim! Primești cel mult un e-mail pe lună.' : 'Linkul a fost deja folosit sau nu mai e valid.'}</p>
      <Link href="/" className="btn btn-secondary mt-6">Înapoi la site</Link>
    </div>
  )
}
