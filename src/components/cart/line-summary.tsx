import { Icon } from '@/components/icons'
import type { CartLine } from '@/server/cart'

const RX: Record<string, { text: string; tone: string }> = {
  manual: { text: 'Rețetă completată', tone: 'text-ok' },
  upload: { text: 'Poza rețetei încărcată', tone: 'text-ok' },
  saved: { text: 'Rețetă salvată', tone: 'text-ok' },
  later: { text: 'Rețeta o trimiți după comandă', tone: 'text-warn' },
}

export function LineSummary({ line }: { line: Pick<CartLine, 'configuration' | 'priced'> }) {
  const parts = line.priced.lines.filter((l) => l.code !== 'frame')
  const rx = line.configuration.rxMode ? RX[line.configuration.rxMode] : null
  return (
    <div className="flex flex-col gap-1">
      {parts.length ? <p className="text-[13.5px] leading-snug text-graphite">{parts.map((p) => p.label).join(' · ')}</p> : null}
      {rx ? (
        <p className={`flex items-center gap-1.5 text-[13px] font-bold ${rx.tone}`}>
          <Icon name={line.configuration.rxMode === 'later' ? 'clock' : 'check'} size={15} /> {rx.text}
        </p>
      ) : null}
    </div>
  )
}
