'use client'

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-[20px] bg-glass p-8 ring-1 ring-line-soft">
      <div className="eyebrow">Eroare{error.digest ? ` · ${error.digest}` : ''}</div>
      <h1 className="mt-3 text-[24px] font-bold">Secțiunea nu s-a putut încărca.</h1>
      <p className="mt-2 max-w-xl text-[14.5px] text-graphite">{process.env.NODE_ENV === 'development' ? error.message : 'Detaliile sunt în logurile serverului (codul de mai sus).'}</p>
      <button type="button" onClick={reset} className="btn btn-ink btn-sm mt-6">Reîncearcă</button>
    </div>
  )
}
