import Link from 'next/link'
import { Wordmark } from '@/components/brand'
import { Icon } from '@/components/icons'
import { ConsentManager } from '@/components/site/consent'

/** Focused layout for the configurator and checkout: no navigation, no footer noise. */
export default function FlowLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-fog/85 backdrop-blur-md">
        <div className="container-x flex h-16 items-center justify-between">
          <Wordmark size={18} />
          <div className="flex items-center gap-5 text-[14px]">
            <span className="hidden items-center gap-1.5 text-graphite sm:flex">
              <Icon name="lock" size={16} /> Conexiune securizată
            </span>
            <Link href="/cos" className="flex items-center gap-1.5 font-bold no-underline hover:underline">
              <Icon name="bag" size={18} /> Coș
            </Link>
          </div>
        </div>
      </header>
      <main id="continut" className="min-h-[calc(100dvh-64px)]">
        {children}
      </main>
      <footer className="container-x flex flex-wrap items-center justify-between gap-3 border-t border-line py-6 text-[13px] text-graphite">
        <span>© Sifra Vision · Str. Alexandru Cernat 188, Galați</span>
        <span className="flex gap-4">
          <Link href="/livrare-si-plata" className="hover:text-ink">Livrare</Link>
          <Link href="/retur-si-garantie" className="hover:text-ink">Retur</Link>
          <Link href="/politica-de-confidentialitate" className="hover:text-ink">Confidențialitate</Link>
        </span>
      </footer>
      <ConsentManager />
    </>
  )
}
