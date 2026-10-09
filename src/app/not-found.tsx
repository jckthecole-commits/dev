import Link from 'next/link'
import { StatusPage } from '@/components/site/status-page'

export const metadata = { title: 'Pagina nu există', robots: { index: false } }

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="Aici nu se mai vede nimic clar."
      actions={
        <>
          <Link href="/rame-de-vedere" className="btn btn-ink">Rame de vedere</Link>
          <Link href="/ochelari-de-soare" className="btn btn-secondary">Ochelari de soare</Link>
          <Link href="/cautare" className="btn btn-ghost">Caută</Link>
        </>
      }
    >
      Pagina a fost mutată sau adresa are o literă greșită. Încearcă din catalog — sau scrie-ne și te ajutăm să găsești rama.
    </StatusPage>
  )
}
