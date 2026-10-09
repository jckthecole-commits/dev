'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { onFirstInteraction } from '@/lib/interaction'

type Toast = typeof import('sonner').toast

let markReady: () => void = () => {}
const ready = new Promise<void>((r) => (markReady = r))
const wakers = new Set<() => void>()
let wanted = false

/** Show a toast; the toaster (Sonner) is fetched the first time it is needed. */
export function notify(show: (toast: Toast) => void) {
  if (!wanted) {
    wanted = true
    wakers.forEach((w) => w())
  }
  void Promise.all([import('sonner'), ready]).then(([m]) => show(m.toast))
}

const ToasterImpl = dynamic(() => import('./toaster-impl'), { ssr: false })

/** Mounted once in the layout; renders nothing until a toast is wanted or the visitor interacts. */
export function LazyToaster() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const wake = () => setOn(true)
    wakers.add(wake)
    if (wanted) queueMicrotask(wake)
    const stop = onFirstInteraction(wake)
    return () => {
      wakers.delete(wake)
      stop()
    }
  }, [])
  return on ? <ToasterImpl onReady={markReady} /> : null
}
