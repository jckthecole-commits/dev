import type { Metadata } from 'next'
import { asc, eq } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { Suspense } from 'react'
import { Booking } from '@/components/booking/booking'
import { db } from '@/lib/db'
import { service } from '@/lib/db/schema'

export const metadata: Metadata = {
  title: 'Programare consultație optometrică în Galați',
  description: 'Programează online o consultație optometrică, o probă de rame sau ajustarea ochelarilor în showroom-ul Sifra Vision din Galați, Str. Alexandru Cernat 188.',
  alternates: { canonical: '/programare' },
}

async function getServices() {
  'use cache'
  cacheTag('services')
  cacheLife('hours')
  return db.select({ code: service.code, name: service.name, summary: service.summary, durationMin: service.durationMin, price: service.price }).from(service).where(eq(service.active, true)).orderBy(asc(service.position))
}

export default async function BookingPage({ searchParams }: PageProps<'/programare'>) {
  const services = await getServices()
  return (
    <div className="container-x pb-16 pt-10">
      <div className="eyebrow">Showroom Galați · Str. Alexandru Cernat 188</div>
      <h1 className="disp mt-3 text-[clamp(44px,6vw,88px)]">Programează-te.</h1>
      <p className="mt-4 max-w-2xl text-[17px] text-ink-2">Consultație optometrică, probă de rame cu măsurători sau o ajustare rapidă. Alege ora care ți se potrivește — confirmarea vine imediat pe e-mail.</p>
      <div className="mt-10">
        <Suspense fallback={<Booking services={services} />}>
          <WithParams services={services} searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  )
}

async function WithParams({ services, searchParams }: { services: Awaited<ReturnType<typeof getServices>>; searchParams: PageProps<'/programare'>['searchParams'] }) {
  const sp = await searchParams
  return <Booking services={services} initialService={typeof sp.serviciu === 'string' ? sp.serviciu : undefined} />
}
