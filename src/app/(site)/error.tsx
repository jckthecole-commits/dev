'use client'

import Link from 'next/link'

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="container-x grid min-h-[60vh] place-items-center py-20 text-center">
      <div className="max-w-lg">
        <div className="eyebrow">Eroare{error.digest ? ` · ${error.digest}` : ''}</div>
        <h1 className="disp mt-4 text-[clamp(28px,4vw,42px)]">Ceva nu s-a încărcat cum trebuie.</h1>
        <p className="mt-3 text-graphite">Reîncearcă. Dacă se repetă, sună-ne sau scrie-ne — coșul și comenzile tale sunt în siguranță.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="btn btn-ink">Reîncearcă</button>
          <Link href="/contact" className="btn btn-secondary">Contact</Link>
        </div>
      </div>
    </section>
  )
}
