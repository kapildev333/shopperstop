import { formatInr } from '@shopperstop/ui/format'
import { ChevronRight } from 'lucide-react-native'
import { Pressable, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { openCartSheet, useCart } from './cart'
import { ReplacedNotice } from './cart-alert'
import { itemCount } from './cart-guest'
import { Text } from './ui/text'
import { colors, fontFamily, radius, shadows } from './ui/tokens'

// The cart bar: the count and total of the cart as one button that opens the cart sheet. Nothing while the cart is empty.
// `edge` adds the bottom safe area on stack screens; the tab bar already holds it on tabs.
export function CartBar({ edge }: { edge?: boolean }) {
  const { view } = useCart()
  if (!view || view.items.length === 0) return null
  const count = itemCount(view.items)
  const countText = count === 1 ? '1 item' : `${count} items`
  const body = (
    <>
      {view.replaced ? <ReplacedNotice view={view} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View cart, ${countText}, ${formatInr(view.totalCents)}`}
        onPress={() => openCartSheet()}
        style={styles.bar}
      >
        <View>
          <Text variant="small" tone="onAccent" tabular>
            {countText}
          </Text>
          <Text variant="body" tone="onAccent" tabular style={styles.total}>
            {formatInr(view.totalCents)}
          </Text>
        </View>
        <View style={styles.view}>
          <Text variant="button" tone="onAccent">
            View cart
          </Text>
          <View aria-hidden>
            <ChevronRight size={16} color={colors.onAccent} />
          </View>
        </View>
      </Pressable>
    </>
  )
  return edge ? (
    <SafeAreaView edges={['bottom']} style={styles.wrap}>
      {body}
    </SafeAreaView>
  ) : (
    <View style={styles.wrap}>{body}</View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 12, paddingHorizontal: 16, gap: 8 },
  bar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderRadius: radius.card,
    backgroundColor: colors.accent,
    boxShadow: shadows.sheet.boxShadow,
  },
  total: { fontFamily: fontFamily(700) },
  view: { flexDirection: 'row', alignItems: 'center', gap: 4 },
})
