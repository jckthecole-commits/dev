import Link from 'next/link'
import { Icon } from '@/components/icons'
import { getCartCount } from '@/server/cart'

export async function CartCount() {
  const n = await getCartCount()
  return (
    <Link href="/cos" aria-label={n ? `Coș, ${n} ${n === 1 ? 'produs' : 'produse'}` : 'Coș, gol'} className="relative inline-flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/[.07]">
      <Icon name="bag" />
      {n > 0 ? (
        <span className="absolute right-1 top-1 grid min-w-[18px] place-items-center rounded-full bg-cobalt px-1 font-mono text-[10.5px] font-medium leading-[18px] text-white">{n}</span>
      ) : null}
    </Link>
  )
}
