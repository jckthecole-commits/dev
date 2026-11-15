'use client'

import { Button } from './ui'

export function PrintButton() {
  return <Button variant="secondary" small onClick={() => window.print()}>Printează / PDF</Button>
}
