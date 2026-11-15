import Link from 'next/link'

export default function Forbidden() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-xl font-semibold">Nu ai acces aici</h1>
      <p className="mt-2 text-sm text-muted">Rolul tău nu include această pagină.</p>
      <Link href="/" className="mt-4 inline-block text-sm text-accent underline">Înapoi acasă</Link>
    </div>
  )
}
