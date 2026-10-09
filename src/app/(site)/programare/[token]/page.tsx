import type { Metadata } from 'next'
import { eq } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import { cancelBooking } from '@/app/actions/booking'
import { db } from '@/lib/db'
import { appointment } from '@/lib/db/schema'
import { formatDate, formatTime } from '@/lib/format'
import { getSettings } from '@/server/settings'

export const metadata: Metadata = { title: 'Programarea ta', robots: { index: false } }

export default function ManageBooking({ params }: Pick<PageProps<'/programare/[token]'>, 'params'>) {
  return (
    <div className="container-x grid min-h-[60vh] place-items-center py-16">
      <Suspense fallback={<div className="skeleton h-72 w-full max-w-lg" />}>
        <View params={params} />
      </Suspense>
    </div>
  )
}

async function View({ params }: Pick<PageProps<'/programare/[token]'>, 'params'>) {
  const { token } = await params
  const a = await db.query.appointment.findFirst({ where: eq(appointment.manageToken, token), with: { service: true } })
  if (!a) notFound()
  const settings = await getSettings()
  async function cancel() {
    'use server'
    await cancelBooking(token)
    redirect(`/programare/${token}`)
  }
  const cancelled = a.status === 'cancelled'
  return (
    <div className="card w-full max-w-lg bg-glass p-8">
      <div className="eyebrow">{cancelled ? 'Programare anulată' : 'Programarea ta'}</div>
      <h1 className="disp mt-3 text-[40px]">{a.service.name}</h1>
      <p className="mt-3 text-[17px]">
        {formatDate(a.startsAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ora <strong>{formatTime(a.startsAt)}</strong>
      </p>
      <p className="mt-1 text-graphite">
        {settings.company.address}, {settings.company.city}
      </p>
      {!cancelled && a.startsAt > new Date() ? (
        <form action={cancel} className="mt-8">
          <button className="btn btn-secondary">Anulează programarea</button>
        </form>
      ) : null}
      {cancelled ? <a href="/programare" className="btn btn-primary mt-8">Fă o programare nouă</a> : null}
    </div>
  )
}
