import Link from 'next/link'
import { StatusPage } from '@/components/site/status-page'

export const metadata = { title: 'Acces restricționat', robots: { index: false } }

export default function Forbidden() {
  return (
    <StatusPage code="403" title="Zona asta nu e pentru contul tău." actions={<><Link href="/admin" className="btn btn-ink">Panoul tău</Link><Link href="/" className="btn btn-secondary">Site-ul</Link></>}>
      Rolul tău nu are acces la secțiunea cerută. Dacă ai nevoie de ea, cere unui administrator să îți actualizeze rolul din Echipă & roluri.
    </StatusPage>
  )
}
