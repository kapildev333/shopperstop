import { useEffect, useRef, type ReactNode } from 'react'
import { Button, ErrorBanner, Skeleton } from '@shopperstop/ui'
import { useProductFeed } from './catalog'
import { ProductGrid } from './product-card'

// Pages load by scroll and by a visible "Load more" button (keyboard, screen readers, no IntersectionObserver).
export function ProductFeed({
  storeId,
  filter,
  empty,
}: {
  storeId: string
  filter: { categoryId?: string; q?: string }
  empty: ReactNode
}) {
  const { data, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError, isPending } =
    useProductFeed(storeId, filter)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = end.current
    // A failed page does not reload itself: the error banner's retry does.
    if (!node || !hasNextPage || isFetchingNextPage || isFetchNextPageError) return
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) fetchNextPage()
      },
      { rootMargin: '400px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage])

  if (isPending) return <Skeleton variant="grid" count={8} />
  if (error && !data) return <ErrorBanner message="Could not load products." onRetry={() => refetch()} />

  const products = data.pages.flatMap((page) => page.items)
  if (products.length === 0) return <>{empty}</>

  return (
    <div className="flex flex-col gap-6">
      <ProductGrid products={products} />
      {isFetchNextPageError && (
        <ErrorBanner message="Could not load more products." onRetry={() => fetchNextPage()} />
      )}
      {hasNextPage && (
        <div ref={end} className="flex justify-center">
          <Button variant="secondary" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}
