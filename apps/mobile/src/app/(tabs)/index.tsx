import { ChevronDown, Search, User } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import Head from 'expo-router/head'
import { useEffect } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useCategories, usePicks } from '../../catalog'
import { CategoryGrid, ProductCard } from '../../catalog-card'
import { openPincodeSheet, usePincode } from '../../pincode'
import { useStore } from '../../serviceability'
import { StoreGate } from '../../serviceability-gate'
import { IconButton } from '../../ui/button'
import { ErrorBanner } from '../../ui/error-banner'
import { Skeleton } from '../../ui/skeleton'
import { Text } from '../../ui/text'
import { colors, fontFamily, radius, spacing } from '../../ui/tokens'

// Home: the brand header with the delivery promise, then the categories and picks of the open store.
export default function Home() {
  const router = useRouter()
  const { pincode, loaded } = usePincode()
  const state = useStore()
  const open = state.kind === 'open' ? state.store : undefined

  // The sheet opens once on the first visit: a pincode read that found none, and nothing chosen since.
  useEffect(() => {
    if (loaded && !pincode) openPincodeSheet()
  }, [loaded, pincode])

  return (
    <View role="main" style={styles.screen}>
      <Head>
        <title>Home · ShopperStop</title>
      </Head>
      <SafeAreaView edges={['top']} style={styles.brand}>
        <View style={styles.headerRow}>
          <View style={styles.titleBlock}>
            {open ? (
              <Text variant="small" tone="onBrand" style={styles.eyebrow}>
                ShopperStop in
              </Text>
            ) : null}
            <Text
              variant="display"
              tone="onBrand"
              heading={1}
              accessibilityLabel={open ? `ShopperStop in ${open.promisedMinutes} minutes` : 'ShopperStop'}
            >
              {open ? `${open.promisedMinutes} minutes` : 'ShopperStop'}
            </Text>
            <Pressable accessibilityRole="button" onPress={openPincodeSheet} style={styles.pincodeButton}>
              <Text variant="body" tone="onBrand" style={styles.pincodeText}>
                {pincode ? `Delivering to ${pincode}` : 'Choose pincode'}
              </Text>
              <ChevronDown size={16} color={colors.onBrand} aria-hidden />
            </Pressable>
          </View>
          <View style={styles.account}>
            <IconButton label="Account" icon={User} onPress={() => router.push('/account')} />
          </View>
        </View>
        {open ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search products"
            onPress={() => router.push('/search')}
            style={styles.search}
          >
            <Search size={20} color={colors.inkMuted} aria-hidden />
            <Text variant="body" tone="inkMuted">
              Search "milk"
            </Text>
          </Pressable>
        ) : null}
      </SafeAreaView>
      <ScrollView contentContainerStyle={styles.body}>
        <StoreGate>{(store) => <Sections storeId={store.id} />}</StoreGate>
      </ScrollView>
    </View>
  )
}

function Sections({ storeId }: { storeId: string }) {
  return (
    <>
      <CategoriesSection storeId={storeId} />
      <PicksSection storeId={storeId} />
    </>
  )
}

// Each section follows its own loading and error pattern.
function CategoriesSection({ storeId }: { storeId: string }) {
  const categories = useCategories(storeId)
  return (
    <View style={styles.categories}>
      <Text variant="h2" heading={2} style={styles.sectionTitle}>
        Shop by category
      </Text>
      {categories.data ? (
        <CategoryGrid categories={categories.data} />
      ) : categories.isError ? (
        <ErrorBanner error={categories.error} onRetry={() => void categories.refetch()} />
      ) : (
        <Skeleton variant="tiles" columns={4} count={8} />
      )}
    </View>
  )
}

function PicksSection({ storeId }: { storeId: string }) {
  const picks = usePicks(storeId)
  return (
    <View style={styles.picks}>
      <Text variant="h2" heading={2} style={styles.picksTitle}>
        Picked for you
      </Text>
      {picks.data ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          {picks.data.map((product) => (
            <View key={product.id} style={styles.pick}>
              <ProductCard product={product} storeId={storeId} />
            </View>
          ))}
        </ScrollView>
      ) : picks.isError ? (
        <ErrorBanner error={picks.error} onRetry={() => void picks.refetch()} />
      ) : (
        <Skeleton variant="tiles" columns={2} count={2} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  brand: { backgroundColor: colors.brand },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.unit * 3,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.unit * 4,
    paddingBottom: spacing.unit * 3,
  },
  titleBlock: { flex: 1 },
  eyebrow: { fontFamily: fontFamily(700), textTransform: 'uppercase', letterSpacing: 0.3 },
  pincodeButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.unit },
  pincodeText: { fontFamily: fontFamily(600) },
  account: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.unit * 2,
    marginHorizontal: spacing.gutter,
    marginBottom: spacing.unit * 3,
    paddingHorizontal: spacing.unit * 3,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  body: { paddingBottom: spacing.unit * 6 },
  categories: { backgroundColor: colors.surface, padding: spacing.gutter },
  sectionTitle: { marginBottom: spacing.unit * 3 },
  picks: { marginTop: spacing.unit * 2, backgroundColor: colors.surface, paddingVertical: spacing.gutter },
  picksTitle: { marginHorizontal: spacing.gutter, marginBottom: spacing.unit * 3 },
  rail: { paddingHorizontal: spacing.gutter, gap: spacing.unit * 3 },
  pick: { width: 148 },
})
