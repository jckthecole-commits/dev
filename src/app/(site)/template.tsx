import { ViewTransition } from 'react'

/** Every navigation: the old page drops out of focus and the new one pulls into it (styles in globals.css). */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div>{children}</div>
    </ViewTransition>
  )
}
