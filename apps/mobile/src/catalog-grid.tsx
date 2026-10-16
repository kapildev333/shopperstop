import { type ReactElement } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { pageSize, useProductPages, type ProductFilter, type StoreProduct } from './catalog'
import { ProductCard } from './catalog-card'
import { ErrorBanner } from './ui/error-banner'
import { Button } from './ui/button'
import { Skeleton } from './ui/skeleton'
import { colors, spacing } from './ui/tokens'

type Props = {
  storeId: string
  filter: ProductFilter
  header?: ReactElement
  empty: ReactElement
}

// Two columns of product cards over the paged list. Pages load on "Load more" and when the list's end is reached.
// ponytail: initialNumToRender is 24 rows (two pages of two columns), so the first two pages mount at once and windowing takes over past that. Lower it if a device walk shows a slow mount.
export function ProductGrid({ storeId, filter, header, empty }: Props) {
  const pages = useProductPages(storeId, filter)
  if (!pages.data) {
    if (pages.isError) return <ErrorBanner error={pages.error} onRetry={() => void pages.refetch()} />
    return <Skeleton variant="tiles" columns={2} count={6} />
  }
  const items: StoreProduct[] = pages.data.pages.flatMap((page) => page.items)
  if (items.length === 0) return empty

  const loadMore = () => {
    if (pages.hasNextPage && !pages.isFetchingNextPage) void pages.fetchNextPage()
  }
  return (
    <FlatList
      testID="product-grid"
      data={items}
      numColumns={2}
      keyExtractor={(product) => product.id}
      renderItem={({ item }) => (
        // A lone last product keeps half the row: the cell is capped at half width.
        <View style={styles.cell}>
          <ProductCard product={item} storeId={storeId} />
        </View>
      )}
      ListHeaderComponent={header}
      ListFooterComponent={
        pages.hasNextPage ? (
          <Button variant="secondary" size="md" loading={pages.isFetchingNextPage} onPress={loadMore}>
            Load more
          </Button>
        ) : undefined
      }
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.content}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      initialNumToRender={pageSize}
      style={styles.list}
    />
  )
}

const styles = StyleSheet.create({
  list: { backgroundColor: colors.canvas },
  row: { gap: spacing.unit * 2 },
  cell: { flex: 1, maxWidth: '50%' },
  content: { padding: spacing.unit * 2, gap: spacing.unit * 2 },
})
