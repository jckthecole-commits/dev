import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AuthForm } from '@/components/account/auth-form'

export const metadata: Metadata = { title: 'Contul meu — autentificare', robots: { index: false } }

const google = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

export default function LoginPage({ searchParams }: Pick<PageProps<'/cont/autentificare'>, 'searchParams'>) {
  return (
    <div className="container-x grid gap-12 py-14 lg:grid-cols-2 lg:items-center">
      <div>
        <div className="eyebrow">Contul meu</div>
        <h1 className="disp mt-3 text-[clamp(44px,6vw,84px)]">Totul, la vedere.</h1>
        <p className="mt-4 max-w-md text-[17px] text-ink-2">Comenzile și starea lor, rețetele salvate (criptate), programările din showroom. O singură parolă.</p>
      </div>
      <div className="flex justify-center lg:justify-end">
        <Suspense fallback={<AuthForm next="/cont" google={google} />}>
          <WithNext searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  )
}

async function WithNext({ searchParams }: Pick<PageProps<'/cont/autentificare'>, 'searchParams'>) {
  const sp = await searchParams
  const raw = typeof sp.next === 'string' ? sp.next : '/cont'
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/cont'
  return <AuthForm next={next} google={google} />
}
