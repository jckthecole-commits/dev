'use client'

import { useActionForm } from '@/lib/use-action-form'
import { useState } from 'react'
import { submitReview } from '@/app/actions/reviews'
import { Icon } from '@/components/icons'

export function ReviewForm({ productId, productName }: { productId: string; productName: string }) {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [state, onSubmit, pending] = useActionForm(submitReview, null)
  if (state?.ok) return <p className="mt-6 flex items-center gap-2 rounded-xl bg-ok-50 p-4 text-[14.5px] text-ok"><Icon name="check" size={18} /> {state.message}</p>
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary mt-6">
        Scrie o recenzie
      </button>
    )
  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="rating" value={rating} />
      <input type="text" name="website" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />
      <fieldset>
        <legend className="mb-2 text-[14px] font-bold">Nota pentru {productName}</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" aria-label={`${i} stele`} aria-pressed={rating === i} onClick={() => setRating(i)} className="p-0.5">
              <Icon name="star" size={28} className={i <= rating ? 'fill-ink text-ink' : 'text-line'} />
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <input name="name" required placeholder="Numele tău" aria-label="Numele tău" className="field" />
        <input name="city" placeholder="Orașul (opțional)" aria-label="Orașul" className="field" />
      </div>
      <input name="title" placeholder="Titlu (opțional)" aria-label="Titlu" className="field" />
      <textarea name="body" required minLength={20} rows={4} placeholder="Cum stă, cât de ușoară e, cum arată în realitate…" aria-label="Recenzia ta" className="field h-auto py-3" />
      <select name="fit" aria-label="Mărimea" className="field" defaultValue="">
        <option value="">Cum vine ca mărime? (opțional)</option>
        <option value="narrow">Vine strâmtă</option>
        <option value="true">Mărime corectă</option>
        <option value="wide">Vine largă</option>
      </select>
      {state && !state.ok ? <p className="text-[14px] text-err">{state.message}</p> : null}
      <button type="submit" disabled={pending} className="btn btn-ink">
        {pending ? 'Se trimite…' : 'Trimite recenzia'}
      </button>
      <p className="text-[12.5px] text-graphite">Recenziile sunt verificate de echipă înainte de publicare. Nu publicăm adresa de e-mail.</p>
    </form>
  )
}
