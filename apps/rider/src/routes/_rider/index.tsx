import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@shopperstop/ui'

// The Pick up page: the ready list and the assigned deliveries come with their own task.
function PickUp() {
  return <PageHeader title="Ready to pick up" />
}

export const Route = createFileRoute('/_rider/')({
  component: PickUp,
})
