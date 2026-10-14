import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Card, ErrorBanner, PageHeader, Skeleton } from '@shopperstop/ui'
import { categoriesQuery, categoryOptions } from '../../../../catalog'
import { ProductForm } from '../../../../product-form'

function NewProduct() {
  const categories = useQuery(categoriesQuery)
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title="New product" />
      {categories.data === undefined ? (
        categories.isError ? (
          <ErrorBanner message="Could not load the categories." onRetry={() => void categories.refetch()} />
        ) : (
          <Skeleton variant="list" count={3} />
        )
      ) : (
        <Card className="p-6">
          <ProductForm categories={categoryOptions(categories.data.items)} />
        </Card>
      )}
    </div>
  )
}

export const Route = createFileRoute('/_staff/_admin/products/new')({ component: NewProduct })
