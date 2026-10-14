import { useEffect } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ErrorBanner, PageHeader, Skeleton, buttonClass } from '@shopperstop/ui'
import { usePicked, useCategories } from '../catalog'
import { getPincode, openPincodeSheet } from '../pincode'
import { ImageTile, ProductGrid } from '../product-card'
import { StoreGate } from '../store-gate'

function Home() {
  // Every visit without a stored pincode asks for one; closing the sheet leaves the "Set your pincode" notice.
  useEffect(() => {
    if (!getPincode()) openPincodeSheet()
  }, [])
  return <StoreGate title="Groceries in minutes">{(store) => <HomeContent storeId={store.id} />}</StoreGate>
}

function HomeContent({ storeId }: { storeId: string }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Groceries in minutes" />
      <Categories storeId={storeId} />
      <Picked storeId={storeId} />
    </div>
  )
}

function Categories({ storeId }: { storeId: string }) {
  const { data, error, refetch } = useCategories(storeId)
  if (data === undefined) {
    return error ? (
      <ErrorBanner message="Could not load categories." onRetry={() => refetch()} />
    ) : (
      <Skeleton variant="grid" count={6} />
    )
  }
  return (
    <>
      <nav aria-label="Categories" className="overflow-x-auto">
        <ul className="flex w-max gap-2">
          {data.map((parent) => (
            <li key={parent.id}>
              <Link to="/c/$slug" params={{ slug: parent.slug }} className={buttonClass({ variant: 'secondary' })}>
                {parent.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <section aria-labelledby="shop-by-category" className="flex flex-col gap-3">
        <h2 id="shop-by-category" className="text-h2 text-ink">
          Shop by category
        </h2>
        <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-12">
          {data.map((parent) => (
            <li key={parent.id}>
              <Link to="/c/$slug" params={{ slug: parent.slug }} className="flex flex-col items-center gap-2">
                <ImageTile src={parent.imageUrl} />
                <span className="text-center text-small text-ink">{parent.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

function Picked({ storeId }: { storeId: string }) {
  const { data, error, refetch } = usePicked(storeId)
  return (
    <section aria-labelledby="picked-for-you" className="flex flex-col gap-3">
      <h2 id="picked-for-you" className="text-h2 text-ink">
        Picked for you
      </h2>
      {data ? (
        <ProductGrid products={data} />
      ) : error ? (
        <ErrorBanner message="Could not load products." onRetry={() => refetch()} />
      ) : (
        <Skeleton variant="grid" count={12} />
      )}
    </section>
  )
}

export const Route = createFileRoute('/')({
  component: Home,
})
