import { createFileRoute } from '@tanstack/react-router'
import { Card, EmptyState, PageHeader } from '@shopperstop/ui'

function Home() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Groceries in minutes" />
      <Card className="p-6">
        <EmptyState title="Set your pincode" description="Enter your pincode to see the store that delivers to you." />
      </Card>
    </div>
  )
}

export const Route = createFileRoute('/')({
  component: Home,
})
