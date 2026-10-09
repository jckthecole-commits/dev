'use client'

import Link from 'next/link'
import { useRef, useState, ViewTransition } from 'react'
import { FrameArt } from '@/components/frame-art'
import { Icon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/format'
import type { ProductCard as Card } from '@/lib/catalog-query'
import { artOf, swatchCss } from '@/lib/product-art'
import { FavoriteButton } from './favorite-button'

export const MATERIAL: Record<string, string> = { acetat: 'acetat', metal: 'metal', titan: 'titan', tr90: 'TR90', combinat: 'combinat' }

export function ProductCard({ product: p, initialVariant, eager }: { product: Card; initialVariant?: string; eager?: boolean }) {
  const [vid, setVid] = useState(initialVariant ?? (p.variants.find((v) => v.isDefault) ?? p.variants[0])!.id)
  const v = p.variants.find((x) => x.id === vid) ?? p.variants[0]!
  const art = artOf(p)
  const [loupe, setLoupe] = useState<{ x: number; y: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const href = `/rame/${p.slug}${v.isDefault ? '' : `?culoare=${v.colorSlug}`}`
  const scale = Math.min(92, (p.frameWidth / 152) * 92) // shared scale: sizes stay comparable across the grid
  const soldOut = p.variants.every((x) => x.available <= 0)

  return (
    <article className="group relative flex flex-col">
      <Link href={href} className="relative block no-underline" aria-label={`${p.name}, ${v.colorName}, ${formatPrice(p.price + v.priceDelta)}`}>
        <div
          ref={box}
          className="relative aspect-[5/4] overflow-hidden rounded-[var(--radius-card)] bg-glass ring-1 ring-line-soft ring-inset transition-shadow duration-300 group-hover:shadow-[var(--shadow-lift)]"
          onPointerMove={(e) => {
            if (e.pointerType !== 'mouse' || p.image) return
            const r = box.current!.getBoundingClientRect()
            setLoupe({ x: e.clientX - r.left, y: e.clientY - r.top })
          }}
          onPointerLeave={() => setLoupe(null)}
        >
          {p.image ? (
            <img src={`/media/${p.image.key.replace(/^public\//, '')}`} alt={p.image.alt || p.name} loading={eager ? 'eager' : 'lazy'} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 grid place-items-center">
              <ViewTransition name={`frame-${p.slug}`}>
                <div style={{ width: `${scale}%` }} className="transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:-translate-y-1">
                  <FrameArt product={art} swatch={v.swatch} shadow className="h-auto w-full" title={`${p.name} ${v.colorName}`} />
                </div>
              </ViewTransition>
            </div>
          )}
          {loupe ? (
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ clipPath: `circle(64px at ${loupe.x}px ${loupe.y}px)` }}>
              <div className="absolute inset-0 grid place-items-center bg-glass" style={{ transformOrigin: `${loupe.x}px ${loupe.y}px`, transform: 'scale(2.3)' }}>
                <div style={{ width: `${scale}%` }}>
                  <FrameArt product={art} swatch={v.swatch} className="h-auto w-full" idSalt="loupe" />
                </div>
              </div>
            </div>
          ) : null}
          {loupe ? <div aria-hidden className="lens-ring pointer-events-none absolute size-32" style={{ left: loupe.x - 64, top: loupe.y - 64 }} /> : null}
          <div className="absolute left-3 top-3 flex gap-1.5">
            {p.badge ? <span className="rounded-full bg-paper px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink ring-1 ring-line-soft">{p.badge}</span> : null}
            {soldOut ? <span className="rounded-full bg-ink px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-fog">La comandă</span> : null}
          </div>
        </div>
      </Link>
      <div className="absolute right-3 top-3 opacity-100 transition-opacity lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
        <FavoriteButton slug={p.slug} name={p.name} />
      </div>

      <div className="mt-3.5 flex items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <h3 className="text-[16px] font-bold leading-tight">
            <Link href={href} className="no-underline after:absolute after:inset-0 after:content-[''] md:after:hidden">
              {p.name}
            </Link>
          </h3>
          <p className="spec mt-1 truncate">
            {p.lensWidth}□{p.bridgeWidth} {p.templeLength} · {MATERIAL[p.material] ?? p.material}
            {p.weightGrams ? ` · ${p.weightGrams} g` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[15px] font-bold tnum">{formatPrice(p.price + v.priceDelta)}</div>
          {p.compareAtPrice ? <div className="text-[12.5px] text-mist line-through tnum">{formatPrice(p.compareAtPrice)}</div> : null}
        </div>
      </div>
      <div className="relative z-10 mt-2.5 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5" role="radiogroup" aria-label={`Culori ${p.name}`}>
          {p.variants.map((x) => (
            <button
              key={x.id}
              type="button"
              role="radio"
              aria-checked={x.id === v.id}
              aria-label={x.colorName}
              title={x.colorName}
              onClick={() => setVid(x.id)}
              className={cn('grid size-7 place-items-center rounded-full transition-shadow', x.id === v.id ? 'ring-[1.5px] ring-ink' : 'ring-1 ring-transparent hover:ring-line')}
            >
              <span className="size-[18px] rounded-full ring-1 ring-black/10" style={{ background: swatchCss(x.swatch) }} />
            </button>
          ))}
        </div>
        <Link href={`/configurator/${p.slug}?culoare=${v.colorSlug}`} className="group/c inline-flex items-center gap-1 text-[13.5px] font-bold text-cobalt no-underline">
          {p.category === 'sun' ? 'Cu dioptrii?' : 'Alege lentile'}
          <Icon name="arrow-right" size={16} className="transition-transform group-hover/c:translate-x-0.5" />
        </Link>
      </div>
    </article>
  )
}
