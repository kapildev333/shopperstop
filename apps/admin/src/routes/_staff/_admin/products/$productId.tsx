import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Card, ErrorBanner, PageHeader, Skeleton } from '@shopperstop/ui'
import type { ApiError } from '../../../../api'
import { categoriesQuery, categoryOptions, productQuery } from '../../../../catalog'
import { NotFound } from '../../../../not-found'
import { ProductForm } from '../../../../product-form'

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
      <PageHeader title={product.data.name} />
      <Card className="p-6">
        <ProductForm key={product.data.id} product={product.data} categories={categoryOptions(categories.data.items)} />
      </Card>
    </div>
  )
}

export const Route = createFileRoute('/_staff/_admin/products/$productId')({ component: ProductPage })
