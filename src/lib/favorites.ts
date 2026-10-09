'use client'

import { useSyncExternalStore } from 'react'

/** Favorites live in localStorage (no account needed). */
const KEY = 'sv:favorites'
const listeners = new Set<() => void>()
let cache: string[] | null = null

function read(): string[] {
  if (cache) return cache
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]
  } catch {
    cache = []
  }
  return cache
}
function write(next: string[]) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private mode */
  }
  listeners.forEach((l) => l())
}

const EMPTY: string[] = []
export function useFavorites() {
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      const onStorage = (e: StorageEvent) => {
        if (e.key === KEY) {
          cache = null
          cb()
        }
      }
      window.addEventListener('storage', onStorage)
      return () => {
        listeners.delete(cb)
        window.removeEventListener('storage', onStorage)
      }
    },
    read,
    () => EMPTY,
  )
  return {
    list,
    has: (slug: string) => list.includes(slug),
    toggle: (slug: string) => write(list.includes(slug) ? list.filter((s) => s !== slug) : [slug, ...list].slice(0, 60)),
  }
}
