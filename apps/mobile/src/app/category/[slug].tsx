import { CartBar } from '../../cart-bar'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import Head from 'expo-router/head'
import { ChevronLeft, Search } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { findCategory, imageUri, useCategories, type Category, type ProductFilter } from '../../catalog'
import { ProductGrid } from '../../catalog-grid'
import { useBack } from '../../screen-support'
import { StoreGate } from '../../serviceability-gate'
import { useStore } from '../../serviceability'
import { Chip } from '../../ui/chip'
import { ErrorBanner } from '../../ui/error-banner'
import { EmptyState } from '../../ui/empty-state'
import { IconButton } from '../../ui/button'
import { ImageTile } from '../../ui/image-tile'
import { Skeleton } from '../../ui/skeleton'
import { Text } from '../../ui/text'
import { colors, fontFamily, spacing } from '../../ui/tokens'

// A parent category: "All" then its children in a left rail; the products of the selected one.
// The header sits outside the gate, so Back works on every notice; its title stays empty until the tree loads.
export default function Category() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const back = useBack()
  const router = useRouter()
  const store = useStore()
  const storeId = store.kind === 'open' ? store.store.id : undefined
  const categories = useCategories(storeId)
  const found = categories.data ? findCategory(categories.data, slug) : undefined
  return (
    <>
      <Head>
        <title>{found ? `${found.parent.name} · ShopperStop` : 'Category · ShopperStop'}</title>
      </Head>
      <View role="main" style={styles.screen}>
        <SafeAreaView edges={['top']} style={styles.header}>
          <IconButton label="Back" icon={ChevronLeft} onPress={back} />
          <Text variant="h3" heading={1} numberOfLines={1} style={styles.title}>
            {found?.parent.name ?? ''}
          </Text>
          <IconButton label="Search" icon={Search} onPress={() => router.push('/search')} />
        </SafeAreaView>
        <StoreGate>{(open) => <CategoryBody storeId={open.id} slug={slug} />}</StoreGate>
        <CartBar edge />
      </View>
    </>
  )
}

function CategoryBody({ storeId, slug }: { storeId: string; slug: string }) {
  const categories = useCategories(storeId)
  const router = useRouter()
  // The filters live here, not in the URL: they survive a tab change (setParams keeps this component mounted).
  const [inStock, setInStock] = useState(false)
  const [cheapestFirst, setCheapestFirst] = useState(false)
  if (!categories.data) {
    if (categories.isError) return <ErrorBanner error={categories.error} onRetry={() => void categories.refetch()} />
    return <Skeleton count={4} />
  }
  const found = findCategory(categories.data, slug)
  if (!found) {
    return (
      <EmptyState
        level={1}
        title="Category not found"
        action={
          <Link href="/" asChild>
            <Pressable accessibilityRole="link" style={styles.link}>
              <Text variant="body" tone="accent" style={styles.linkText}>
                Go to Home
              </Text>
            </Pressable>
          </Link>
        }
      />
    )
  }
  const { parent, selected } = found
  const options: Category[] = [parent, ...parent.children]
  // Only the filters that are on are sent; a change starts again at page one (the query key holds the filter).
  const filter: ProductFilter = {
    categoryId: selected.id,
    ...(inStock ? { inStock: true } : {}),
    ...(cheapestFirst ? { sort: 'price_asc' as const } : {}),
  }
  return (
    <View style={styles.body}>
      <View role="tablist" accessibilityLabel="Subcategories" style={styles.rail}>
        <ScrollView>
          {options.map((option) => {
            const isSelected = option.id === selected.id
            return (
              <Pressable
                key={option.id}
                role="tab"
                aria-selected={isSelected}
                accessibilityState={{ selected: isSelected }}
                onPress={() => router.setParams({ slug: option.slug })}
                style={[styles.tab, isSelected && styles.tabSelected]}
              >
                {isSelected ? <View style={styles.bar} /> : null}
                <ImageTile uri={imageUri(option.imageUrl)} size={52} radius="card" />
                <Text variant="small" style={[styles.tabName, isSelected && styles.tabNameSelected]}>
                  {option === parent ? 'All' : option.name}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </View>
      <View style={styles.products}>
        <View style={styles.filters}>
          <Chip selected={inStock} onPress={() => setInStock(!inStock)}>
            In stock
          </Chip>
          <Chip selected={cheapestFirst} onPress={() => setCheapestFirst(!cheapestFirst)}>
            Price: low to high
          </Chip>
        </View>
        <ProductGrid
          storeId={storeId}
          filter={filter}
          empty={<EmptyState title="No products here yet" />}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    paddingHorizontal: spacing.unit * 2,
    gap: spacing.unit,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  title: { flex: 1 },
  body: { flex: 1, flexDirection: 'row' },
  rail: { width: 80, borderRightWidth: 1, borderRightColor: colors.line },
  tab: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, gap: 4, minHeight: 44 },
  bar: { position: 'absolute', right: 0, top: 8, bottom: 8, width: 4, borderRadius: 4, backgroundColor: colors.accent },
  tabSelected: { backgroundColor: colors.accentSoft },
  tabName: { textAlign: 'center' },
  tabNameSelected: { fontFamily: fontFamily(600) },
  products: { flex: 1, backgroundColor: colors.canvas },
  filters: { flexDirection: 'row', gap: spacing.unit * 2, paddingHorizontal: spacing.unit * 2, paddingTop: spacing.unit * 2 },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontFamily: fontFamily(600) },
})
