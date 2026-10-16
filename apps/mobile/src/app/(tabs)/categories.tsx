import { CartBar } from '../../cart-bar'
import Head from 'expo-router/head'
import { ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useCategories } from '../../catalog'
import { CategoryGrid } from '../../catalog-card'
import { StoreGate } from '../../serviceability-gate'
import { ErrorBanner } from '../../ui/error-banner'
import { Skeleton } from '../../ui/skeleton'
import { Text } from '../../ui/text'
import { colors, spacing } from '../../ui/tokens'

// The Categories tab: every parent category of the open store, four to a row.
export default function Categories() {
  return (
    <View role="main" style={styles.screen}>
      <Head>
        <title>Categories · ShopperStop</title>
      </Head>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerRow}>
          <Text variant="h2" heading={1}>
            Categories
          </Text>
        </View>
      </SafeAreaView>
      <StoreGate>{(store) => <AllCategories storeId={store.id} />}</StoreGate>
      <CartBar />
    </View>
  )
}

function AllCategories({ storeId }: { storeId: string }) {
  const categories = useCategories(storeId)
  if (categories.isError) return <ErrorBanner error={categories.error} onRetry={() => void categories.refetch()} />
  if (!categories.data) return <Skeleton variant="tiles" columns={4} count={8} />
  return (
    <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
      <CategoryGrid categories={categories.data} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: { backgroundColor: colors.surface },
  headerRow: {
    height: 64,
    justifyContent: 'center',
    paddingHorizontal: spacing.gutter,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  body: { backgroundColor: colors.surface },
  bodyContent: { padding: spacing.gutter },
})
