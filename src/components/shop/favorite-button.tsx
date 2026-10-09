'use client'

import { Icon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { useFavorites } from '@/lib/favorites'

export function FavoriteButton({ slug, name, className, withLabel }: { slug: string; name: string; className?: string; withLabel?: boolean }) {
  const fav = useFavorites()
  const on = fav.has(slug)
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Scoate ${name} din favorite` : `Adaugă ${name} la favorite`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        fav.toggle(slug)
      }}
      className={cn('inline-flex items-center justify-center gap-2 rounded-full transition-[transform,background-color] active:scale-90', withLabel ? 'btn btn-ghost btn-sm' : 'size-10 bg-glass/80 backdrop-blur hover:bg-glass', className)}
    >
      <Icon name="heart" size={20} className={cn('transition-colors', on && 'fill-cobalt text-cobalt')} />
      {withLabel ? (on ? 'În favorite' : 'Favorite') : null}
    </button>
  )
}
