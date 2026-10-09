'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

/**
 * GDPR / ePrivacy cookie consent. Nothing non-essential loads before a choice.
 * Google Consent Mode v2 signals are set; GA4 and Meta Pixel scripts are only
 * injected after the matching category is accepted.
 */
type Consent = { v: 1; analytics: boolean; marketing: boolean; at: string }
const COOKIE = 'sv_consent'
const GA = process.env.NEXT_PUBLIC_GA_ID
const PIXEL = process.env.NEXT_PUBLIC_META_PIXEL_ID

function read(): Consent | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`))
  if (!m) return null
  try {
    const c = JSON.parse(decodeURIComponent(m[1]!)) as Consent
    return c.v === 1 ? c : null
  } catch {
    return null
  }
}
function write(c: Consent) {
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(c))}; Max-Age=${60 * 60 * 24 * 182}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
}

type W = Window & { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void; fbq?: ((...a: unknown[]) => void) & { q?: unknown[] }; __svLoaded?: Record<string, boolean> }

function apply(c: Consent) {
  const w = window as W
  w.dataLayer = w.dataLayer || []
  w.gtag = w.gtag || function gtag(...args: unknown[]) { w.dataLayer!.push(args) }
  w.__svLoaded = w.__svLoaded || {}
  w.gtag('consent', 'update', {
    analytics_storage: c.analytics ? 'granted' : 'denied',
    ad_storage: c.marketing ? 'granted' : 'denied',
    ad_user_data: c.marketing ? 'granted' : 'denied',
    ad_personalization: c.marketing ? 'granted' : 'denied',
  })
  if (c.analytics && GA && !w.__svLoaded.ga) {
    w.__svLoaded.ga = true
    const s = document.createElement('script')
    s.async = true
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA}`
    document.head.appendChild(s)
    w.gtag('js', new Date())
    w.gtag('config', GA, { anonymize_ip: true })
  }
  if (c.marketing && PIXEL && !w.__svLoaded.px) {
    w.__svLoaded.px = true
    const fbq = function (...args: unknown[]) { (fbq.q = fbq.q || []).push(args) } as NonNullable<W['fbq']>
    w.fbq = fbq
    const s = document.createElement('script')
    s.async = true
    s.src = 'https://connect.facebook.net/en_US/fbevents.js'
    document.head.appendChild(s)
    fbq('init', PIXEL)
    fbq('track', 'PageView')
  }
}

export function ConsentManager() {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)

  useEffect(() => {
    const w = window as W
    w.dataLayer = w.dataLayer || []
    w.gtag = w.gtag || function gtag(...args: unknown[]) { w.dataLayer!.push(args) }
    w.gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', wait_for_update: 500 })
    const c = read()
    if (c) {
      apply(c)
      setAnalytics(c.analytics)
      setMarketing(c.marketing)
    } else {
      const t = setTimeout(() => setOpen(true), 900)
      return () => clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    const onOpen = () => {
      setCustom(true)
      setOpen(true)
    }
    window.addEventListener('sv:consent-open', onOpen)
    return () => window.removeEventListener('sv:consent-open', onOpen)
  }, [])

  const save = (a: boolean, m: boolean) => {
    const c: Consent = { v: 1, analytics: a, marketing: m, at: new Date().toISOString() }
    write(c)
    apply(c)
    setAnalytics(a)
    setMarketing(m)
    setOpen(false)
    setCustom(false)
  }

  if (!open) return null
  return (
    <div role="dialog" aria-modal="false" aria-labelledby="consent-title" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-[560px] rounded-[22px] bg-glass p-5 shadow-[0_30px_70px_-30px_rgba(13,18,22,.55)] ring-1 ring-line sm:inset-x-auto sm:right-5 sm:bottom-5 sm:mx-0" style={{ animation: 'fadeup .5s var(--ease-out-expo) both' }}>
      <h2 id="consent-title" className="text-[17px] font-bold">Cookie-uri, la vedere</h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
        Folosim cookie-uri necesare pentru coș și cont. Cu acordul tău, folosim și cookie-uri de analiză și marketing. Detalii în{' '}
        <Link href="/politica-cookies" className="text-cobalt underline">
          politica de cookies
        </Link>
        .
      </p>
      {custom ? (
        <div className="mt-4 flex flex-col gap-2">
          <Toggle label="Strict necesare" hint="coș, autentificare, preferințe" checked disabled onChange={() => {}} />
          <Toggle label="Analiză" hint="Google Analytics 4, anonimizat" checked={analytics} onChange={setAnalytics} />
          <Toggle label="Marketing" hint="Meta Pixel — măsurarea campaniilor" checked={marketing} onChange={setMarketing} />
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {custom ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => save(analytics, marketing)}>
            Salvează alegerea
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => save(true, true)}>
              Accept toate
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => save(false, false)}>
              Doar necesare
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCustom(true)}>
              Personalizez
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Toggle({ label, hint, checked, disabled, onChange }: { label: string; hint: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl bg-paper px-3.5 py-2.5 ring-1 ring-line-soft">
      <span>
        <span className="block text-[14px] font-bold">{label}</span>
        <span className="block text-[12.5px] text-graphite">{hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className="relative h-6 w-10 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-cobalt peer-disabled:opacity-60 peer-focus-visible:outline-2 peer-focus-visible:outline-cobalt after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4" />
    </label>
  )
}

export function CookiePrefsLink() {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event('sv:consent-open'))} className="w-fit text-left underline-offset-2 hover:underline">
      Preferințe cookies
    </button>
  )
}
