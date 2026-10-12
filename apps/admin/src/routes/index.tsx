import { createFileRoute } from '@tanstack/react-router'
import { Card, EmptyState, PageHeader } from '@shopperstop/ui'

function Dashboard() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" />
      <Card className="p-6">
        <EmptyState title="No stores to show yet" description="Store cards appear here after sign-in." />
      </Card>
    </div>
  )
}

export const Route = createFileRoute('/')({
  component: Dashboard,
})
