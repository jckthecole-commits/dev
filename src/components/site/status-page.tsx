import Link from 'next/link'
import { Wordmark } from '@/components/brand'

/**
 * Full-screen status page (404 / 403 / 500) built on the eye-chart motif:
 * the code is the top line of an optotype; the lines below lose focus.
 */
export function StatusPage({ code, title, children, actions }: { code: string; title: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  const rows = ['E F P', 'T O Z L', 'P E C F D', 'E D F C Z P']
  return (
    <main id="continut" className="grid min-h-dvh place-items-center bg-fog px-5 py-16 text-ink">
      <div className="w-full max-w-xl text-center">
        <Wordmark size={15} className="mx-auto" />
        <div aria-hidden className="mx-auto mt-12 select-none">
          <div className="chart-row text-[clamp(84px,18vw,148px)] tnum">{code.split('').join(' ')}</div>
          {rows.map((r, i) => (
            <div key={r} className="chart-row text-graphite" style={{ fontSize: `${28 - i * 5}px`, filter: `blur(${0.6 + i * 0.9}px)`, opacity: 0.85 - i * 0.12, marginTop: 6 }}>
              {r}
            </div>
          ))}
        </div>
        <h1 className="disp mt-10 text-[clamp(28px,4vw,40px)]">{title}</h1>
        {children ? <div className="mx-auto mt-3 max-w-md text-[16px] leading-relaxed text-graphite">{children}</div> : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">{actions ?? <Link href="/" className="btn btn-ink">Înapoi la prima pagină</Link>}</div>
      </div>
    </main>
  )
}
