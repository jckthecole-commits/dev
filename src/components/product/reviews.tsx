import { Icon } from '@/components/icons'
import { formatDate } from '@/lib/format'
import { ReviewForm } from './review-form'

type R = { id: string; name: string; city: string | null; rating: number; title: string | null; body: string; fit: string | null; verifiedPurchase: boolean; reply: string | null; createdAt: Date }

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex" aria-label={`${value} din 5 stele`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" size={size} className={i <= Math.round(value) ? 'fill-ink text-ink' : 'text-line'} />
      ))}
    </span>
  )
}

const FIT: Record<string, string> = { narrow: 'Vine strâmtă', true: 'Mărime corectă', wide: 'Vine largă' }

export function Reviews({ productId, productName, reviews, rating }: { productId: string; productName: string; reviews: R[]; rating: { count: number; avg: number | null } }) {
  return (
    <section aria-labelledby="recenzii" className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
      <div>
        <div className="eyebrow">Recenzii</div>
        <h2 id="recenzii" className="disp mt-3 text-[clamp(30px,3.6vw,46px)]">
          Ce spun cei care o poartă.
        </h2>
        {rating.count ? (
          <div className="mt-5 flex items-center gap-3">
            <span className="disp text-[44px] tnum">{rating.avg?.toFixed(1).replace('.', ',')}</span>
            <span>
              <Stars value={rating.avg ?? 0} size={18} />
              <span className="spec block">{rating.count} recenzii verificate</span>
            </span>
          </div>
        ) : (
          <p className="mt-4 text-[15.5px] text-ink-2">Încă nu are recenzii. Ai purtat-o? Spune-le și altora cum e.</p>
        )}
        <ReviewForm productId={productId} productName={productName} />
      </div>
      <div>
        {reviews.length ? (
          <ul className="divide-y divide-line border-y border-line">
            {reviews.map((r) => (
              <li key={r.id} className="py-6">
                <div className="flex items-center justify-between gap-4">
                  <Stars value={r.rating} />
                  <span className="spec">{formatDate(r.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                {r.title ? <h3 className="mt-3 text-[17px] font-bold">{r.title}</h3> : null}
                <p className="mt-2 text-[15.5px] leading-relaxed text-ink-2">{r.body}</p>
                <div className="spec mt-3 flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    {r.name}
                    {r.city ? `, ${r.city}` : ''}
                  </span>
                  {r.verifiedPurchase ? <span className="text-ok">✓ cumpărare verificată</span> : null}
                  {r.fit ? <span>{FIT[r.fit]}</span> : null}
                </div>
                {r.reply ? (
                  <div className="mt-4 rounded-xl bg-glass p-4 text-[14.5px] ring-1 ring-line-soft">
                    <strong>Sifra Vision:</strong> {r.reply}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="card grid h-full min-h-56 place-items-center p-10 text-center">
            <div>
              <div aria-hidden className="chart-row text-[40px] text-ink/60 blur-[3px]">
                ★★★★★
              </div>
              <p className="mt-3 text-graphite">Prima recenzie poate fi a ta.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
