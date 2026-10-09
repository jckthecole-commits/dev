import { asc } from 'drizzle-orm'
import Link from 'next/link'
import { Suspense } from 'react'
import { saveProduct } from '@/app/admin/_actions/products'
import { ProductEditor } from '@/components/admin/product-editor'
import { PageHeader } from '@/components/admin/ui'
import { db } from '@/lib/db'
import { location } from '@/lib/db/schema'
import { newProductState } from '@/lib/product-editor-state'
import { requireStaff } from '@/server/session'

export const metadata = { title: 'Produs nou' }

export default function NewProduct() {
  return (
    <Suspense fallback={<div className="skeleton h-[800px]" />}>
      <Editor />
    </Suspense>
  )
}

async function Editor() {
  await requireStaff('catalog:write')
  const locations = await db.select({ id: location.id, code: location.code, name: location.name, kind: location.kind }).from(location).orderBy(asc(location.code))
  return (
    <>
      <PageHeader eyebrow="Catalog" title="Produs nou" actions={<Link href="/admin/produse" className="btn btn-ghost btn-sm">Renunță</Link>}>
        <p className="mt-2 max-w-2xl text-[14.5px] text-graphite">Introdu dimensiunile reale din catalogul producătorului — desenul ramei, filtrele după mărime și proba virtuală se generează din ele, la scară 1:1.</p>
      </PageHeader>
      <ProductEditor initial={newProductState(locations)} locations={locations} action={saveProduct.bind(null, null)} isNew />
    </>
  )
}
