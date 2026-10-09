import { permanentRedirect } from 'next/navigation'

/** Short, memorable guide URLs used across the UI → journal articles. */
const MAP: Record<string, string> = {
  prescriptie: '/jurnal/cum-citesti-prescriptia-de-ochelari',
  'marimea-ramei': '/jurnal/cum-alegi-marimea-ramei',
  progresive: '/jurnal/lentile-progresive-ghid',
  indice: '/jurnal/indicele-de-refractie-lentile-subtiate',
}

export function generateStaticParams() {
  return Object.keys(MAP).map((slug) => ({ slug }))
}

export default async function Guide({ params }: Pick<PageProps<'/ghid/[slug]'>, 'params'>) {
  permanentRedirect(MAP[(await params).slug] ?? '/jurnal')
}
