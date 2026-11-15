import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-xl font-semibold">Pagina nu există</h1>
      <Link href="/" className="mt-4 inline-block text-sm text-accent underline">Înapoi acasă</Link>
    </div>
  )
}
