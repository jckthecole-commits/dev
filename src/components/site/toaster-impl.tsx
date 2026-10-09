'use client'

import { useEffect } from 'react'
import { Toaster } from 'sonner'

/** The real toaster (Sonner) — loaded on demand by <LazyToaster>. */
export default function ToasterImpl({ onReady }: { onReady: () => void }) {
  useEffect(() => onReady(), [onReady])
  return <Toaster position="bottom-center" gap={10} offset={20} toastOptions={{ unstyled: true, classNames: { toast: 'sv-toast', title: 'sv-toast-title', description: 'sv-toast-desc', actionButton: 'sv-toast-action' } }} />
}
