import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button, Card, Dialog, DialogFooter, ErrorBanner, PageHeader, Skeleton } from '@shopperstop/ui'
import { api, type ApiError } from '../../../../api'
import { NotFound } from '../../../../not-found'
import { ServiceAreas } from '../../../../service-areas'
import { StoreForm } from '../../../../store-form'
import { storeQuery, storesQuery, type AdminStore } from '../../../../stores'

function DeleteStore({ store }: { store: AdminStore }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await api.DELETE('/admin/stores/{id}', { params: { path: { id: store.id } } })
      if (error) throw error.error
    },
    onSuccess: async () => {
      void queryClient.invalidateQueries({ queryKey: storesQuery.queryKey, exact: true })
      await navigate({ to: '/stores' })
    },
  })
  const inUse = (remove.error as Partial<ApiError> | null)?.code === 'conflict'

  return (
    <>
      <Button variant="secondary" onClick={() => { remove.reset(); setOpen(true) }}>Delete store</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Delete ${store.name}?`}>
        <p className="mt-2 text-body text-ink">The store and the pincodes it serves are removed.</p>
        {remove.error && (
          <ErrorBanner
            className="mt-4"
            message={inUse ? 'This store still has staff users or orders. Remove its staff users first; a store with orders cannot be deleted.' : 'Could not delete the store. Try again.'}
          />
        )}
        <DialogFooter onCancel={() => setOpen(false)}>
          <Button loading={remove.isPending} onClick={() => remove.mutate()}>Delete</Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}

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
      <PageHeader title={store.data.name} actions={<DeleteStore store={store.data} />} />
      <Card className="p-6">
        <StoreForm key={store.data.id} store={store.data} />
      </Card>
      <Card className="p-6">
        <ServiceAreas storeId={storeId} />
      </Card>
    </div>
  )
}

export const Route = createFileRoute('/_staff/_admin/stores/$storeId')({ component: StorePage })
