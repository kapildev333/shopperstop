import { Link, useLocalSearchParams } from 'expo-router'
import Head from 'expo-router/head'
import type { UseQueryResult } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react-native'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  findCategoryById,
  imageUri,
  stockLabel,
  useCategories,
  useMoreIn,
  useProduct,
  type CategoryNode,
  type StoreProduct,
} from '../../catalog'
import { useLineWrite, useQuantity } from '../../cart'
import { CartWriteAlert } from '../../cart-alert'
import { useBack } from '../../screen-support'
import { useStore } from '../../serviceability'
import { StoreGate } from '../../serviceability-gate'
import { Badge } from '../../ui/badge'
import { IconButton } from '../../ui/button'
import { EmptyState } from '../../ui/empty-state'
import { ErrorBanner } from '../../ui/error-banner'
import { ImageTile } from '../../ui/image-tile'
import { Price } from '../../ui/price'
import { Skeleton } from '../../ui/skeleton'
import { Stepper } from '../../ui/stepper'
import { Text } from '../../ui/text'
import { colors, fontFamily, radius, shadows, spacing } from '../../ui/tokens'

// The product screen: the image with Back over it, the details, "More in" the category, and the bar with the stepper.
// Back sits outside the gate, so it works on every notice; the product and categories load for the open store only.
export default function Product() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const back = useBack()
  const store = useStore()
  const storeId = store.kind === 'open' ? store.store.id : undefined
  const product = useProduct(storeId, slug)
  const categories = useCategories(storeId)
  return (
    <>
      <Head>
        <title>{product.data ? `${product.data.name} · ShopperStop` : 'Product · ShopperStop'}</title>
      </Head>
      <View role="main" style={styles.screen}>
        <StoreGate>
          {(open) => <ProductBody storeId={open.id} product={product} categories={categories.data} />}
        </StoreGate>
        <SafeAreaView edges={['top']} style={styles.backBar}>
          <View style={styles.backCircle}>
            <IconButton label="Back" icon={ChevronLeft} onPress={back} />
          </View>
        </SafeAreaView>
      </View>
    </>
  )
}

function ProductBody({
  storeId,
  product,
  categories,
}: {
  storeId: string
  product: UseQueryResult<StoreProduct | null>
  categories?: CategoryNode[]
}) {
  if (product.isError) return <ErrorBanner error={product.error} onRetry={() => void product.refetch()} />
  if (product.data === undefined) return <Skeleton count={3} />
  if (product.data === null) {
    return (
      <EmptyState
        level={1}
        title="Product not found"
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
  return <ProductDetail storeId={storeId} product={product.data} categories={categories} />
}

function ProductDetail({ storeId, product, categories }: { storeId: string; product: StoreProduct; categories?: CategoryNode[] }) {
  const count = useQuantity(product.id)
  const [failure, write] = useLineWrite(storeId, product)
  const found = categories ? findCategoryById(categories, product.categoryId) : undefined
  const stock = product.inStock ? stockLabel(product.quantity) : undefined
  const percent = product.mrpCents > product.priceCents ? Math.floor(((product.mrpCents - product.priceCents) * 100) / product.mrpCents) : 0
  const trail = found ? ['Home', found.parent.name, ...(found.selected.id === found.parent.id ? [] : [found.selected.name])] : ['Home']
  return (
    <View style={styles.body}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.imageBlock}>
          <ImageTile uri={imageUri(product.imageUrl)} radius="card" />
        </View>
        <View style={styles.info}>
          <Text variant="small" tone="inkMuted">
            {trail.join(' / ')}
          </Text>
          <Text variant="h1" heading={1}>
            {product.name}
          </Text>
          <Text variant="body" tone="inkMuted">
            {product.unitLabel}
          </Text>
          {stock || percent >= 1 ? (
            <View style={styles.badges}>
              {stock ? <Badge variant={product.quantity >= 10 ? 'neutral' : 'warning'}>{stock}</Badge> : null}
              {percent >= 1 ? <Badge variant="success">{`${percent}% off`}</Badge> : null}
            </View>
          ) : null}
        </View>
        <View style={styles.details}>
          <Text variant="h3" heading={2}>
            Product details
          </Text>
          <View style={styles.pairs}>
            <Pair label="Unit" value={product.unitLabel} />
            {found ? <Pair label="Category" value={found.selected.name} /> : null}
            {product.brand ? <Pair label="Brand" value={product.brand} /> : null}
            {product.description ? <Pair label="Description" value={product.description} wide /> : null}
          </View>
        </View>
        <MoreIn storeId={storeId} product={product} name={found?.selected.name} />
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={styles.bar}>
        <View style={styles.barPrice}>
          <Price cents={product.priceCents} mrpCents={product.mrpCents} size="lg" layout="row" />
          <Text variant="small" tone="inkMuted">
            Inclusive of all taxes
          </Text>
          <CartWriteAlert message={failure} />
        </View>
        <Stepper
          size="lg"
          label={product.name}
          value={count}
          max={product.inStock ? product.quantity : 0}
          onChange={write}
        />
      </SafeAreaView>
    </View>
  )
}

function Pair({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={wide ? styles.wide : styles.pair}>
      <Text variant="small" tone="inkMuted">
        {label}
      </Text>
      <Text variant="body" style={wide ? undefined : styles.strong}>
        {value}
      </Text>
    </View>
  )
}

// Secondary content: nothing while loading, after a failure, or when the category holds no other product.
function MoreIn({ storeId, product, name }: { storeId: string; product: StoreProduct; name?: string }) {
  const more = useMoreIn(storeId, product)
  if (!more.data || more.data.length === 0) return null
  return (
    <View style={styles.more}>
      <Text variant="h3" heading={2} style={styles.moreHeading}>
        {name ? `More in ${name}` : 'More in this category'}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {more.data.map((item) => (
          <Link key={item.id} href={`/product/${item.slug}`} asChild>
            <Pressable accessibilityRole="link" accessibilityLabel={item.name} style={styles.railItem}>
              <ImageTile uri={imageUri(item.imageUrl)} size={120} radius="card" />
              <Text variant="body" numberOfLines={2} style={styles.strong}>
                {item.name}
              </Text>
              <Price cents={item.priceCents} />
            </Pressable>
          </Link>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  backBar: { position: 'absolute', top: 0, left: 0, paddingLeft: 28, paddingTop: 12 },
  backCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    boxShadow: shadows.card.boxShadow,
  },
  body: { flex: 1 },
  // Clears the bar: its height plus 16.
  scroll: { paddingBottom: 120 },
  imageBlock: { backgroundColor: colors.surface, padding: spacing.gutter, paddingBottom: 12 },
  info: { backgroundColor: colors.surface, paddingHorizontal: spacing.gutter, paddingTop: 4, paddingBottom: spacing.gutter, gap: spacing.unit * 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.unit * 2 },
  details: { backgroundColor: colors.surface, padding: spacing.gutter, gap: 12, marginTop: spacing.unit * 2 },
  pairs: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  pair: { width: '47%' },
  wide: { width: '100%' },
  strong: { fontFamily: fontFamily(600) },
  more: { backgroundColor: colors.surface, paddingVertical: spacing.gutter, marginTop: spacing.unit * 2 },
  moreHeading: { marginHorizontal: spacing.gutter, marginBottom: 12 },
  rail: { paddingHorizontal: spacing.gutter, gap: 12 },
  railItem: { width: 120, gap: 4 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.gutter,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: colors.surface,
    boxShadow: shadows.sheet.boxShadow,
  },
  barPrice: { flex: 1, gap: spacing.unit },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontFamily: fontFamily(600) },
})
