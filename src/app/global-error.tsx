'use client'

import './globals.css'

/** Last-resort boundary (root layout failed). Keeps the brand, no external deps. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ro">
      <body className="grid min-h-dvh place-items-center bg-fog p-6 text-center text-ink">
        <div className="max-w-md">
          <div className="font-mono text-[12px] uppercase tracking-[0.2em] text-graphite">Sifra Vision</div>
          <h1 className="mt-6 text-[32px] font-bold leading-tight">Ceva nu a mers. Ne uităm imediat.</h1>
          <p className="mt-3 text-graphite">Reîncearcă peste câteva secunde. Comenzile și plățile tale sunt în siguranță.</p>
          <button type="button" onClick={reset} className="btn btn-ink mt-8">Reîncearcă</button>
        </div>
      </body>
    </html>
  )
}
