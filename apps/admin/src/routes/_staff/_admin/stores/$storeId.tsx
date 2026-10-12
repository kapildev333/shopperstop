import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Card, ErrorBanner, PageHeader, Skeleton } from '@shopperstop/ui'
import type { ApiError } from '../../../../api'
import { NotFound } from '../../../../not-found'
import { StoreForm } from '../../../../store-form'
import { storeQuery } from '../../../../stores'

function StorePage() {
  const { storeId } = Route.useParams()
  const store = useQuery(storeQuery(storeId))
  if (store.isPending) return <Skeleton variant="list" count={3} />
  if (store.isError) {
    if ((store.error as Partial<ApiError>).code === 'not_found') return <NotFound />
    return <ErrorBanner message="Could not load the store." onRetry={() => void store.refetch()} />
  }
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title={store.data.name} />
      <Card className="p-6">
        <StoreForm key={store.data.id} store={store.data} />
      </Card>
    </div>
  )
}

export const Route = createFileRoute('/_staff/_admin/stores/$storeId')({ component: StorePage })
