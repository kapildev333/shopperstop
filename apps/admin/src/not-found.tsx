import { Link } from '@tanstack/react-router'
import { Card, EmptyState, PageHeader, buttonClass } from '@shopperstop/ui'

export function NotFound() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Page not found" />
      <Card className="p-6">
        <EmptyState
          title="Nothing here"
          description="This page does not exist or your role cannot open it."
          action={<Link to="/" className={buttonClass({ variant: 'secondary' })}>Go to Dashboard</Link>}
        />
      </Card>
    </div>
  )
}
