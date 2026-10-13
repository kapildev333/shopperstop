import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button, Card, Dialog, DialogFooter, ErrorBanner, PageHeader, Skeleton } from '@shopperstop/ui'
import { api, type ApiError } from '../../../../api'
import { categoriesQuery, categoryOptions, productQuery, type Product } from '../../../../catalog'
import { ImageUpload } from '../../../../image'
import { NotFound } from '../../../../not-found'
import { ProductForm } from '../../../../product-form'

// Confirm, then delete. A product that was ordered stays (409); the dialog offers to deactivate it instead.
function DeleteProduct({ product }: { product: Product }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await api.DELETE('/admin/products/{id}', { params: { path: { id: product.id } } })
      if (error) throw error.error
    },
    onSuccess: () => navigate({ to: '/products' }),
  })
  const deactivate = useMutation({
    mutationFn: async () => {
      const { error } = await api.PATCH('/admin/products/{id}', { params: { path: { id: product.id } }, body: { isActive: false } })
      if (error) throw error.error
    },
    onSuccess: () => navigate({ to: '/products' }),
  })
  const ordered = (remove.error as Partial<ApiError> | null)?.code === 'conflict'

  function close() {
    setOpen(false)
    remove.reset()
    deactivate.reset()
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>Delete product</Button>
      <Dialog open={open} onClose={close} title={`Delete ${product.name}?`}>
        {remove.error && (
          <ErrorBanner
            className="mt-4"
            message={ordered ? 'This product was ordered, so it cannot be deleted. Deactivate it instead: customers no longer see it.' : 'Could not delete the product. Try again.'}
          />
        )}
        {deactivate.error && <ErrorBanner className="mt-4" message="Could not deactivate the product. Try again." />}
        <DialogFooter onCancel={close}>
          {ordered ? (
            <Button loading={deactivate.isPending} onClick={() => deactivate.mutate()}>Deactivate instead</Button>
          ) : (
            <Button loading={remove.isPending} onClick={() => remove.mutate()}>Delete</Button>
          )}
        </DialogFooter>
      </Dialog>
    </>
  )
}

function ProductPage() {
  const { productId } = Route.useParams()
  const product = useQuery(productQuery(productId))
  const categories = useQuery(categoriesQuery)
  if (product.isPending || categories.isPending) return <Skeleton variant="list" count={3} />
  if (product.isError && (product.error as Partial<ApiError>).code === 'not_found') return <NotFound />
  if (product.isError || categories.isError) {
    const retry = () => void Promise.all([product.refetch(), categories.refetch()])
    return <ErrorBanner message="Could not load the product." onRetry={retry} />
  }
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title={product.data.name} actions={<DeleteProduct product={product.data} />} />
      <Card className="p-6">
        <ProductForm key={product.data.id} product={product.data} categories={categoryOptions(categories.data.items)} />
      </Card>
      <Card className="p-6">
        <ImageUpload kind="products" id={product.data.id} name={product.data.name} imageUrl={product.data.imageUrl} />
      </Card>
    </div>
  )
}

export const Route = createFileRoute('/_staff/_admin/products/$productId')({ component: ProductPage })
