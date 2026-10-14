import type { ReactNode } from 'react'
import { Button, Card, EmptyState, ErrorBanner, PageHeader, Skeleton } from '@shopperstop/ui'
import { useServiceability, type Store } from './catalog'
import { openPincodeSheet, usePincode } from './pincode'

// Every catalog page renders through this: children get an open store, anything else is a notice.
export function StoreGate({ title, children }: { title: string; children: (store: Store) => ReactNode }) {
  const { pincode } = usePincode()
  const { data, error, refetch } = useServiceability(pincode)

  if (!pincode) {
    return (
      <Frame title={title}>
        <Notice title="Set your pincode" description="Enter your pincode to see the store that delivers to you.">
          <Button onClick={openPincodeSheet}>Choose pincode</Button>
        </Notice>
      </Frame>
    )
  }
  // A failed refetch keeps the answer on screen; the alert shows only with nothing held.
  if (data === undefined) {
    return (
      <Frame title={title}>
        {error ? (
          <ErrorBanner message="Could not check your pincode." onRetry={() => refetch()} />
        ) : (
          <Skeleton variant="grid" count={8} />
        )}
      </Frame>
    )
  }
  if (!data) {
    return (
      <Frame title={title}>
        <Notice title={`We do not deliver to ${pincode} yet`} description="Try another pincode nearby.">
          <Button variant="secondary" onClick={openPincodeSheet}>
            Change pincode
          </Button>
        </Notice>
      </Frame>
    )
  }
  if (!data.isOpen) {
    return (
      <Frame title={title}>
        <Notice
          title={`${data.name} is closed right now`}
          description="Orders open again when the store does. Try another pincode."
        >
          <Button variant="secondary" onClick={openPincodeSheet}>
            Change pincode
          </Button>
        </Notice>
      </Frame>
    )
  }
  return <>{children(data)}</>
}

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      {children}
    </div>
  )
}

// Notices sit on a card: ink-muted on canvas is below 4.5:1.
function Notice({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card className="p-6">
      <EmptyState title={title} description={description} action={children} />
    </Card>
  )
}
