import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@shopperstop/ui'

// The delivered list comes with its own task.
function History() {
  return <PageHeader title="History" />
}

export const Route = createFileRoute('/_rider/history')({
  component: History,
})
