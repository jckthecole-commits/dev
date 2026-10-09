import { Suspense } from 'react'
import { ConsentManager } from '@/components/site/consent'
import { SiteFooter } from '@/components/site/footer'
import { SiteHeader } from '@/components/site/header'
import { SiteEnhancements } from '@/components/site/enhancements'
import { JsonLd } from '@/components/seo/json-ld'
import { organizationLd, websiteLd } from '@/lib/seo'
import { getSettings } from '@/server/settings'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings()
  return (
    <>
      <a href="#continut" className="sr-only z-50 rounded-full bg-cobalt px-5 py-3 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Sari la conținut
      </a>
      <JsonLd data={[organizationLd(settings), websiteLd()]} />
      <SiteHeader />
      <main id="continut">{children}</main>
      <Suspense>
        <SiteFooter />
      </Suspense>
      <ConsentManager />
      <SiteEnhancements />
    </>
  )
}
