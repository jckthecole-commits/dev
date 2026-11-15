import { formatUsd } from '@/lib/money'

/** Bar chart of a month's daily gross. Plain SVG, no client JS; each bar has a native tooltip. */
export function DailyChart({ data, today }: { data: { day: string; cents: number }[]; today: string }) {
  const max = Math.max(1, ...data.map((d) => d.cents))
  const W = 100 / data.length
  return (
    <figure>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label="Încasări pe zile">
        {data.map((d, i) => {
          const h = (d.cents / max) * 38
          return (
            <rect key={d.day} x={i * W + W * 0.15} y={40 - h} width={W * 0.7} height={Math.max(h, d.cents ? 0.6 : 0)} rx={0.4} className={d.day > today ? 'fill-panel-2' : d.day === today ? 'fill-accent' : 'fill-accent/55'}>
              <title>{`${d.day.slice(8)}: ${formatUsd(d.cents)}`}</title>
            </rect>
          )
        })}
      </svg>
      <figcaption className="mt-2 flex justify-between text-xs text-muted">
        <span>1</span>
        <span>max {formatUsd(max === 1 ? 0 : max)}</span>
        <span>{data.length}</span>
      </figcaption>
    </figure>
  )
}
