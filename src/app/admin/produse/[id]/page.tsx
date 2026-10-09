import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { deleteProductImage, duplicateProduct, moveProductImage, saveProduct, setProductStatus, uploadProductImages } from '@/app/admin/_actions/products'
import { ActionButton } from '@/components/admin/action-button'
import { AdminForm } from '@/components/admin/form'
import { ProductEditor } from '@/components/admin/product-editor'
import { Badge, Field, input, PageHeader, Panel } from '@/components/admin/ui'
import { Icon } from '@/components/icons'
import { db } from '@/lib/db'
import { inventory, location, product, productImage, stockMovement, variant } from '@/lib/db/schema'
import { formatDateTime } from '@/lib/format'
import { productToState } from '@/lib/product-editor-state'
import { publicUrl } from '@/server/storage'
import { requireStaff } from '@/server/session'

export const metadata = { title: 'Editează produs' }

const REASON: Record<string, string> = { sale: 'Vânzare', return: 'Retur', adjustment: 'Ajustare manuală', receipt: 'Recepție', transfer: 'Transfer', b2b: 'Comandă B2B' }

export default function EditProduct({ params, searchParams }: PageProps<'/admin/produse/[id]'>) {
  return (
    <Suspense fallback={<div className="skeleton h-[800px]" />}>
      <Editor params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function Editor({ params, searchParams }: PageProps<'/admin/produse/[id]'>) {
  await requireStaff('catalog:write')
  const { id } = await params
  const sp = await searchParams
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const p = await db.query.product.findFirst({ where: eq(product.id, id) })
  if (!p) notFound()
  const [variants, locations, images] = await Promise.all([
    db.select().from(variant).where(eq(variant.productId, id)).orderBy(asc(variant.position)),
    db.select({ id: location.id, code: location.code, name: location.name, kind: location.kind }).from(location).orderBy(asc(location.code)),
    db.select().from(productImage).where(eq(productImage.productId, id)).orderBy(asc(productImage.position)),
  ])
  const vids = variants.map((v) => v.id)
  const [stock, moves] = vids.length
    ? await Promise.all([
        db.select().from(inventory).where(inArray(inventory.variantId, vids)),
        db
          .select({ m: stockMovement, color: variant.colorName, loc: location.name })
          .from(stockMovement)
          .innerJoin(variant, eq(variant.id, stockMovement.variantId))
          .innerJoin(location, eq(location.id, stockMovement.locationId))
          .where(and(inArray(stockMovement.variantId, vids)))
          .orderBy(desc(stockMovement.createdAt))
          .limit(25),
      ])
    : [[], []]
  const reserved: Record<string, Record<string, number>> = {}
  for (const s of stock) (reserved[s.variantId] ??= {})[s.locationId] = s.reserved
  // only active variants + the ones with history are editable; inactive ones stay visible to re-enable
  const state = productToState(p, variants, stock, locations)

  return (
    <>
      <PageHeader
        eyebrow={`${p.modelCode} · actualizat ${formatDateTime(p.updatedAt)}`}
        title={p.name}
        actions={
          <>
            <ActionButton action={duplicateProduct.bind(null, p.id)} variant="ghost"><Icon name="copy" size={15} /> Duplică</ActionButton>
            {p.status !== 'archived' ? <ActionButton action={setProductStatus.bind(null, p.id, 'archived')} variant="ghost" confirm="Arhivezi produsul? Dispare din magazin, dar rămâne în comenzi și rapoarte.">Arhivează</ActionButton> : null}
          </>
        }
      >
        <div className="mt-3 flex gap-2">
          <Badge tone={p.status === 'active' ? 'ok' : p.status === 'draft' ? 'warn' : 'neutral'}>{p.status === 'active' ? 'Publicat' : p.status === 'draft' ? 'Ciornă' : 'Arhivat'}</Badge>
          {sp.nou ? <Badge tone="info">Creat acum — adaugă poze și publică</Badge> : null}
        </div>
      </PageHeader>

      <ProductEditor initial={state} locations={locations} reserved={reserved} action={saveProduct.bind(null, p.id)} isNew={false} slug={p.slug} />

      <div className="-mt-20 grid gap-6 pb-28 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel title={`Fotografii · ${images.length}`}>
          <p className="mb-4 text-[13.5px] text-graphite">Fără fotografii, magazinul folosește desenul la scară al ramei (generat din dimensiuni). Prima fotografie „packshot” devine imaginea principală. JPG, PNG, WebP sau AVIF, max. 8 MB.</p>
          {images.length ? (
            <ul className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {images.map((img, i) => (
                <li key={img.id} className="overflow-hidden rounded-2xl bg-fog ring-1 ring-line-soft">
                                    <img src={publicUrl(img.key)} alt={img.alt} className="aspect-[4/3] w-full object-contain" loading="lazy" />
                  <div className="flex items-center justify-between gap-1 px-2 py-1.5 text-[12px]">
                    <span className="truncate">{i === 0 ? <strong>principală</strong> : img.kind}{img.variantId ? ` · ${variants.find((v) => v.id === img.variantId)?.colorName ?? ''}` : ''}</span>
                    <span className="flex">
                      <ActionButton action={moveProductImage.bind(null, img.id, -1)} variant="ghost" className="!px-2">←</ActionButton>
                      <ActionButton action={moveProductImage.bind(null, img.id, 1)} variant="ghost" className="!px-2">→</ActionButton>
                      <ActionButton action={deleteProductImage.bind(null, img.id)} variant="ghost" className="!px-2" confirm="Ștergi fotografia?"><Icon name="trash" size={14} /></ActionButton>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          <AdminForm action={uploadProductImages.bind(null, p.id)} submit="Încarcă">
            <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
              <Field label="Fișiere"><input type="file" name="images" multiple accept="image/jpeg,image/png,image/webp,image/avif" className="text-[14px] file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-[13px] file:font-bold file:text-fog" /></Field>
              <Field label="Culoare">
                <select name="variantId" className={input}><option value="">Toate culorile</option>{variants.map((v) => <option key={v.id} value={v.id}>{v.colorName}</option>)}</select>
              </Field>
              <Field label="Tip">
                <select name="kind" className={input}><option value="packshot">Packshot (fundal alb)</option><option value="lifestyle">Purtată / lifestyle</option><option value="detail">Detaliu</option></select>
              </Field>
            </div>
            <Field label="Text alternativ (accesibilitate)" hint="Descrie ce se vede: „Mira 52 havana, vedere din trei sferturi”"><input name="alt" className={input} defaultValue={p.name} /></Field>
          </AdminForm>
        </Panel>
        <Panel title="Mișcări de stoc">
          {moves.length ? (
            <ul className="flex flex-col divide-y divide-line-soft text-[13.5px]">
              {moves.map(({ m, color, loc }) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                  <span>{color} · {loc}<span className="block text-[12px] text-graphite">{REASON[m.reason] ?? m.reason}{m.reference && m.reference !== 'admin' ? ` · ${m.reference}` : ''} · {formatDateTime(m.createdAt)}</span></span>
                  <span className={`font-mono font-bold tnum ${m.delta > 0 ? 'text-ok' : 'text-err'}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13.5px] text-graphite">Nicio mișcare încă. Vânzările, retururile și ajustările apar aici.</p>
          )}
          <Link href="/admin/audit?entity=product" className="mt-3 inline-block text-[13px] font-bold text-cobalt">Jurnal de audit</Link>
        </Panel>
      </div>
    </>
  )
}
