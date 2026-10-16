import { CartBar } from '../cart-bar'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import Head from 'expo-router/head'
import { ChevronLeft, Search as SearchIcon, SearchX, X } from 'lucide-react-native'
import { useRef, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useCategories, useProductPages } from '../catalog'
import { ProductGrid } from '../catalog-grid'
import { useBack } from '../screen-support'
import { StoreGate } from '../serviceability-gate'
import { IconButton } from '../ui/button'
import { Text } from '../ui/text'
import { colors, fontFamily, radius, spacing } from '../ui/tokens'

// The search box starts from `q`; submitting sets `q` on the location, so the results follow the URL.
export default function SearchScreen() {
  const { q } = useLocalSearchParams<{ q?: string }>()
  const back = useBack()
  const router = useRouter()
  const [text, setText] = useState(q ?? '')
  const input = useRef<TextInputInstance>(null)
  return (
    <>
      <Head>
        <title>Search · ShopperStop</title>
      </Head>
      <View role="main" style={styles.screen}>
        <SafeAreaView edges={['top']} style={styles.header}>
          <IconButton label="Back" icon={ChevronLeft} onPress={back} />
          <View accessibilityRole="search" style={styles.box}>
            <SearchIcon size={20} color={colors.inkMuted} />
            <TextInput
              ref={input}
              accessibilityLabel="Search products"
              placeholder="Search products"
              placeholderTextColor={colors.inkMuted}
              value={text}
              onChangeText={setText}
              onSubmitEditing={() => router.setParams({ q: text.trim() || undefined })}
              autoFocus
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            {text ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={6}
                onPress={() => {
                  setText('')
                  input.current?.focus()
                }}
                style={styles.clear}
              >
                <X size={16} color={colors.inkMuted} />
              </Pressable>
            ) : null}
          </View>
        </SafeAreaView>
        <StoreGate>{(open) => <SearchBody storeId={open.id} q={q} />}</StoreGate>
        <CartBar edge />
      </View>
    </>
  )
}

function SearchBody({ storeId, q }: { storeId: string; q?: string }) {
  const categories = useCategories(storeId)
  const links = (categories.data ?? []).map((parent) => (
    <Link key={parent.id} href={`/category/${parent.slug}`} asChild>
      <Pressable accessibilityRole="link" style={styles.link}>
        <Text variant="body" style={styles.linkText}>
          {parent.name}
        </Text>
      </Pressable>
    </Link>
  ))
  if (!q) return <Hint title="Search for products" body="Or browse a category." links={links} />
  return <SearchResults storeId={storeId} q={q} links={links} />
}

function SearchResults({ storeId, q, links }: { storeId: string; q: string; links: ReactNode[] }) {
  const pages = useProductPages(storeId, { q })
  const total = pages.data?.pages[0]?.total ?? 0
  const count = total === 1 ? `1 product for “${q}”` : `${total} products for “${q}”`
  return (
    <ProductGrid
      storeId={storeId}
      filter={{ q }}
      header={
        <Text variant="body" tone="inkMuted" heading={1} style={styles.count}>
          {count}
        </Text>
      }
      empty={
        <Hint title={`No results for “${q}”`} body="Check the spelling, or browse a category instead." links={links} />
      }
    />
  )
}

// The centred state of search: a circle with SearchX, the level-1 heading, a hint and the parent category links.
function Hint({ title, body, links }: { title: string; body: string; links: ReactNode[] }) {
  return (
    <View style={styles.hint}>
      <View aria-hidden style={styles.circle}>
        <SearchX size={36} color={colors.ink} />
      </View>
      <Text variant="h2" heading={1} style={styles.center}>
        {title}
      </Text>
      <Text tone="inkMuted" style={styles.center}>
        {body}
      </Text>
      <View style={styles.links}>{links}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.unit,
    paddingVertical: 10,
    paddingLeft: spacing.unit,
    paddingRight: spacing.unit * 3,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  box: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.unit * 2,
    paddingLeft: spacing.unit * 3,
    paddingRight: spacing.unit * 2,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.control,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily(400),
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
  },
  clear: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  count: { marginHorizontal: spacing.unit, marginBottom: 10 },
  hint: { alignItems: 'center', paddingTop: 48, paddingHorizontal: spacing.gutter, paddingBottom: 24, gap: 12 },
  circle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  center: { textAlign: 'center' },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.unit * 2, paddingHorizontal: 8 },
  link: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.gutter,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  linkText: { fontFamily: fontFamily(400) },
})
