import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSettings } from '@/server/settings'
import { getCurrentUser } from '@/server/session'
import { SignInForm } from './sign-in-form'

export const metadata: Metadata = { title: 'Autentificare' }

export default async function SignInPage() {
  if (await getCurrentUser()) redirect('/')
  const { studioName } = await getSettings()
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold tracking-tight">{studioName}</h1>
        <p className="mb-6 text-center text-sm text-muted">Intră în contul tău</p>
        <div className="rounded-xl border border-line bg-panel p-5">
          <SignInForm />
        </div>
        <p className="mt-4 text-center text-xs text-muted">Contul îl primești de la administratorul studioului.</p>
      </div>
    </main>
  )
}
