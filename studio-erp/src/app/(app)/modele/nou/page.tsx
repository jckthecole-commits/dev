import type { Metadata } from 'next'
import { Card, PageHeader } from '@/components/ui'
import { requirePermission } from '@/server/session'
import { saveModel } from '../actions'
import { ModelForm } from '../model-form'
import { formOptions } from '../shared'

export const metadata: Metadata = { title: 'Model nou' }

export default async function NewModelPage() {
  await requirePermission('models:write')
  const { trainers, plans } = await formOptions()
  return (
    <>
      <PageHeader title="Model nou" />
      <Card>
        <ModelForm action={saveModel.bind(null, null)} trainers={trainers} plans={plans} submitLabel="Creează fișa" />
      </Card>
    </>
  )
}
