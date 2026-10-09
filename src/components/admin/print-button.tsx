'use client'

import { Icon } from '@/components/icons'

export function PrintButton({ label = 'Printează' }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-ink btn-sm">
      <Icon name="print" size={16} /> {label}
    </button>
  )
}
