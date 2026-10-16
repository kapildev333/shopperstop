import { Minus, Plus } from 'lucide-react-native'
import { Pressable, StyleSheet, View } from 'react-native'
import { Button } from './button'
import { Text } from './text'
import { colors, fontFamily, radius } from './tokens'

type Props = { label: string; value: number; max: number; onChange: (next: number) => void; size?: 'md' | 'lg' }

// md controls are 36 tall and the Remove and Add one steps 28 wide: hitSlop takes each to 44 points.
const slop = { top: 4, bottom: 4, left: 4, right: 4 }
const stepSlop = { top: 4, bottom: 4, left: 8, right: 8 }

// A count of 0 is an "ADD" button, the count above 0 a group, and a maximum of 0 a disabled "Out of stock".
export function Stepper({ label, value, max, onChange, size = 'md' }: Props) {
  const lg = size === 'lg'
  if (max <= 0) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        disabled
        style={[styles.outOfStock, lg ? styles.lg : styles.md]}
      >
        <Text variant="small" tone="inkMuted" style={styles.bold}>
          Out of stock
        </Text>
      </Pressable>
    )
  }
  if (value === 0) {
    if (lg) {
      return (
        <Button size="lg" accessibilityLabel={`Add ${label}`} onPress={() => onChange(1)}>
          Add to cart
        </Button>
      )
    }
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add ${label}`}
        hitSlop={slop}
        onPress={() => onChange(1)}
        style={styles.add}
      >
        <Text variant="button" tone="accent">
          ADD
        </Text>
      </Pressable>
    )
  }
  const atMax = value >= max
  return (
    <View accessibilityRole="group" accessibilityLabel={`Quantity of ${label}`} style={[styles.group, lg ? styles.lg : styles.md]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove one ${label}`}
        hitSlop={lg ? undefined : stepSlop}
        onPress={() => onChange(value - 1)}
        style={[styles.step, lg ? styles.stepLg : styles.stepMd]}
      >
        <Minus size={16} color={colors.onAccent} />
      </Pressable>
      <Text variant="button" tone="onAccent" tabular accessibilityLiveRegion="polite" style={[styles.count, lg ? styles.countLg : null]}>
        {String(value)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add one ${label}`}
        accessibilityState={{ disabled: atMax }}
        disabled={atMax}
        hitSlop={lg ? undefined : stepSlop}
        onPress={() => onChange(value + 1)}
        style={[styles.step, lg ? styles.stepLg : styles.stepMd, atMax ? styles.dim : null]}
      >
        <Plus size={16} color={colors.onAccent} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  md: { height: 36 },
  lg: { height: 48 },
  outOfStock: {
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  bold: {
    fontFamily: fontFamily(600),
  },
  add: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 36,
    minWidth: 64,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  step: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepMd: {
    width: 28,
    height: 36,
  },
  stepLg: {
    width: 48,
    height: 48,
  },
  count: {
    minWidth: 16,
    textAlign: 'center',
  },
  countLg: {
    minWidth: 24,
  },
  dim: {
    opacity: 0.5,
  },
})
