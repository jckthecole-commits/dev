import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ResetForm } from '@/components/account/reset-form'

export const metadata: Metadata = { title: 'Resetare parolă', robots: { index: false } }

export default function ResetPage({ searchParams }: PageProps<'/cont/resetare-parola'>) {
  return (
    <div className="container-x grid min-h-[60vh] place-items-center py-14">
      <Suspense fallback={<div className="skeleton h-64 w-full max-w-md" />}>
        <Inner searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function Inner({ searchParams }: PageProps<'/cont/resetare-parola'>) {
  const sp = await searchParams
  return <ResetForm token={typeof sp.token === 'string' ? sp.token : ''} />
}
