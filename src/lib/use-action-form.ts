'use client'

import { startTransition, useActionState } from 'react'

/**
 * Like useActionState, but submits via onSubmit inside a transition so React
 * does NOT reset the form afterwards — users keep what they typed when the
 * server returns validation errors.
 */
export function useActionForm<S>(action: (state: Awaited<S>, formData: FormData) => S | Promise<S>, initial: Awaited<S>) {
  const [state, dispatch, pending] = useActionState(action, initial)
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(() => dispatch(fd))
  }
  return [state, onSubmit, pending] as const
}
