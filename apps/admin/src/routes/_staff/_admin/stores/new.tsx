import { createFileRoute } from '@tanstack/react-router'
import { Card, PageHeader } from '@shopperstop/ui'
import { StoreForm } from '../../../../store-form'

function NewStore() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title="New store" />
      <Card className="p-6">
        <StoreForm />
      </Card>
    </div>
  )
}

export const Route = createFileRoute('/_staff/_admin/stores/new')({ component: NewStore })
