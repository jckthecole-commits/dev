'use client'

import { useActionState, useEffect, useRef, type ReactNode } from 'react'
import { initialState, type ActionState } from '@/lib/action'
import { cn } from './ui'

type Props = {
  action: (prev: ActionState, data: FormData) => Promise<ActionState>
  children: ReactNode | ((state: ActionState, pending: boolean) => ReactNode)
  className?: string
  /** clear the inputs after a successful submit (add forms) */
  resetOnSuccess?: boolean
  confirm?: string
}

/** A form bound to a server action, with its result message under it. Works without JavaScript too. */
export function ActionForm({ action, children, className, resetOnSuccess, confirm }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState)
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset()
  }, [state, resetOnSuccess])
  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault() } : undefined}
    >
      <fieldset disabled={pending} className="contents">
        {typeof children === 'function' ? children(state, pending) : children}
      </fieldset>
      {state.message ? (
        <p role="status" key={state.at} className={cn('mt-3 text-sm whitespace-pre-line', state.ok ? 'text-good' : 'text-bad')}>
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
