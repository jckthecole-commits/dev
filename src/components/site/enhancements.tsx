'use client'

import { useEffect } from 'react'
import { onFirstInteraction } from '@/lib/interaction'

/** Small site-wide extras that never compete with the first paint. */
export function SiteEnhancements() {
  // the motion layer (GSAP, SplitText, ScrollTrigger, Lenis, lens cursor) — loaded on the first interaction
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let cleanup: (() => void) | null = null
    let cancelled = false
    const stop = onFirstInteraction(async () => {
      const { boot } = await import('@/lib/motion/boot')
      if (cancelled) return
      cleanup = await boot()
      if (cancelled) cleanup()
    })
    return () => {
      cancelled = true
      stop()
      cleanup?.()
    }
  }, [])

  // the header turns to dark glass while a [data-tone='dark'] section is under it: an
  // IntersectionObserver whose root is shrunk to a 2 px strip through the header's middle
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('header.header-glass')
    if (!header) return
    const under = new Set<Element>()
    let io: IntersectionObserver | null = null
    const apply = () => {
      // gone from the page, or no longer dark (the anatomy turns light once its 3D starts)
      for (const el of under) if (!el.isConnected || el.getAttribute('data-tone') !== 'dark') under.delete(el)
      if (under.size) header.dataset.over = 'dark'
      else delete header.dataset.over
    }
    // observing an element twice is a no-op, so new sections are simply observed again
    const watch = () => {
      for (const el of document.querySelectorAll('[data-tone="dark"]')) io?.observe(el)
      apply()
    }
    const setup = () => {
      io?.disconnect()
      // the bar is stuck to the top whenever a section can be under it
      const mid = Math.round(header.offsetHeight / 2)
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) under.add(e.target)
            else under.delete(e.target)
          }
          apply()
        },
        { rootMargin: `${-mid}px 0px ${-(window.innerHeight - mid - 2)}px 0px` },
      )
      watch()
    }
    setup()
    // sections stream in and change with every navigation
    let pending = 0
    const mo = new MutationObserver(() => {
      if (pending) return
      pending = window.setTimeout(() => {
        pending = 0
        watch()
      }, 150)
    })
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-tone'] })
    let resize = 0
    const onResize = () => {
      window.clearTimeout(resize)
      resize = window.setTimeout(setup, 200)
    }
    window.addEventListener('resize', onResize, { passive: true })
    return () => {
      io?.disconnect()
      mo.disconnect()
      window.clearTimeout(pending)
      window.clearTimeout(resize)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // elements marked `data-magnetic` lean towards a nearby mouse cursor (one passive listener, mouse only)
  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    let x = -1e4
    let y = -1e4
    const pulled = new Set<HTMLElement>()
    const tick = () => {
      raf = 0
      for (const el of document.querySelectorAll<HTMLElement>('[data-magnetic]')) {
        const r = el.getBoundingClientRect()
        if (r.bottom < 0 || r.top > window.innerHeight) continue
        const dx = x - (r.left + r.width / 2)
        const dy = y - (r.top + r.height / 2)
        const reach = Math.max(r.width, r.height) / 2 + 48
        const d = Math.hypot(dx, dy)
        if (d < reach) {
          const k = (1 - d / reach) * 0.32
          const cap = (v: number) => Math.max(-10, Math.min(10, v)).toFixed(1)
          el.style.translate = `${cap(dx * k)}px ${cap(dy * k)}px`
          pulled.add(el)
        } else if (pulled.has(el)) {
          el.style.translate = ''
          pulled.delete(el)
        }
      }
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      x = e.clientX
      y = e.clientY
      if (!raf) raf = requestAnimationFrame(tick)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
      for (const el of pulled) el.style.translate = ''
    }
  }, [])
  return null
}
